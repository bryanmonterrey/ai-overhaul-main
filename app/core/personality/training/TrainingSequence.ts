// app/core/personality/training/TrainingSequence.ts

import { createClient } from '@supabase/supabase-js';
import { 
  TrainingSequence, 
  TrainingStep, 
  SequenceStatus,
  TrainingOutcome,
  TrainingConfig 
} from './types';
import { PersonalitySystem } from '../PersonalitySystem';
import { TrainingPatternManager } from './TrainingPatternManager';
import { PersonalityState } from '../types';

export class TrainingSequenceManager {
  private activeSequences: Map<string, SequenceStatus> = new Map();
  private supabase;

  constructor(
    private personalitySystem: PersonalitySystem,
    private patternManager: TrainingPatternManager,
    private config: TrainingConfig
  ) {
    this.supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
  }

  public async initializeSequence(sequence: TrainingSequence): Promise<SequenceStatus> {
    // Validate prerequisites
    await this.validatePrerequisites(sequence);

    const status: SequenceStatus = {
      sequenceId: sequence.id,
      currentStep: 0,
      startTime: new Date(),
      lastUpdateTime: new Date(),
      completedSteps: [],
      metrics: {
        averageConfidence: 0,
        emotionalStability: 0,
        traitProgress: {}
      },
      state: 'active'
    };

    // Store in database
    try {
      await this.supabase
        .from('training_sequences')
        .insert({
          id: sequence.id,
          status: status,
          sequence_data: sequence,
          created_at: status.startTime
        });

      this.activeSequences.set(sequence.id, status);
      return status;
    } catch (error) {
      console.error('Error initializing sequence:', error);
      throw error;
    }
  }

  private async validatePrerequisites(sequence: TrainingSequence): Promise<void> {
    if (!sequence.prerequisites) return;

    const currentTraits = this.personalitySystem.getTraits();

    // Check minimum trait requirements
    if (sequence.prerequisites.minimumTraits) {
      for (const [trait, minValue] of Object.entries(sequence.prerequisites.minimumTraits)) {
        if ((currentTraits[trait] || 0) < minValue) {
          throw new Error(`Prerequisite not met: ${trait} is below required value ${minValue}`);
        }
      }
    }

    // Check required sequences
    if (sequence.prerequisites.requiredSequences) {
      const { data: completedSequences } = await this.supabase
        .from('training_sequences')
        .select('id')
        .in('id', sequence.prerequisites.requiredSequences)
        .eq('state', 'completed');

      if (!completedSequences || completedSequences.length !== sequence.prerequisites.requiredSequences.length) {
        throw new Error('Required prerequisite sequences not completed');
      }
    }
  }

  public async processStep(
    sequenceId: string, 
    input: string
  ): Promise<SequenceStatus | null> {
    const status = this.activeSequences.get(sequenceId);
    if (!status || status.state !== 'active') return null;

    const { data: sequenceData } = await this.supabase
      .from('training_sequences')
      .select('sequence_data')
      .eq('id', sequenceId)
      .single();

    if (!sequenceData) return null;

    const sequence: TrainingSequence = sequenceData.sequence_data;
    const currentStep = sequence.steps[status.currentStep];

    try {
      // Check if step requirements are met
      await this.validateStepRequirements(currentStep);

      // Apply the step's pattern
      const outcome = await this.patternManager.applyPattern(
        currentStep.pattern,
        input
      );

      // Update sequence status based on outcome
      await this.updateSequenceStatus(status, currentStep, outcome);

      // Check completion criteria
      if (this.checkStepCompletion(currentStep, this.personalitySystem.getCurrentState())) {
        status.completedSteps.push(status.currentStep);
        status.currentStep++;

        if (status.currentStep >= sequence.steps.length) {
          status.state = 'completed';
        }
      }

      // Update status in database
      await this.updateStatusInDB(status);

      return status;
    } catch (error) {
      console.error('Error processing sequence step:', error);
      status.state = 'failed';
      status.error = {
        step: status.currentStep,
        message: error instanceof Error ? error.message : 'Unknown error occurred',
        timestamp: new Date()
      };
      await this.updateStatusInDB(status);
      return status;
    }
  }

  private async validateStepRequirements(step: TrainingStep): Promise<void> {
    const currentTraits = this.personalitySystem.getTraits();
    const currentState = this.personalitySystem.getCurrentState();

    // Check trait requirements
    for (const [trait, requiredValue] of Object.entries(step.requiredTraits)) {
      if ((currentTraits[trait] || 0) < requiredValue) {
        throw new Error(`Step requirement not met: ${trait} is below required value ${requiredValue}`);
      }
    }

    // Check emotional state requirement
    if (step.requiredEmotionalState && 
        currentState.consciousness.emotionalState !== step.requiredEmotionalState) {
      throw new Error(`Required emotional state ${step.requiredEmotionalState} not met`);
    }
  }

  private async updateSequenceStatus(
    status: SequenceStatus,
    step: TrainingStep,
    outcome: TrainingOutcome
  ): Promise<void> {
    status.lastUpdateTime = new Date();

    // Update metrics
    status.metrics = {
      averageConfidence: this.calculateAverageConfidence(
        status.metrics.averageConfidence,
        outcome.confidenceScore,
        status.completedSteps.length
      ),
      emotionalStability: this.calculateEmotionalStability(outcome),
      traitProgress: this.calculateTraitProgress(
        status.metrics.traitProgress,
        outcome.initialState,
        outcome.resultingState
      )
    };

    // Check for timeout
    if (step.timeout) {
      const elapsed = Date.now() - status.lastUpdateTime.getTime();
      if (elapsed > step.timeout) {
        if (step.retryStrategy && 
            status.completedSteps.length < step.retryStrategy.maxAttempts) {
          // Wait for retry delay
          await new Promise(resolve => 
            setTimeout(resolve, step.retryStrategy!.delayBetweenAttempts)
          );
        } else {
          throw new Error('Step timeout exceeded');
        }
      }
    }
  }

  private calculateAverageConfidence(
    currentAvg: number,
    newScore: number,
    count: number
  ): number {
    return (currentAvg * count + newScore) / (count + 1);
  }

  private calculateEmotionalStability(outcome: TrainingOutcome): number {
    const stabilityScore = outcome.effectivenessMeasures.emotionalAlignment;
    return Math.max(0, Math.min(1, stabilityScore));
  }

  private calculateTraitProgress(
    currentProgress: Record<string, number>,
    initialState: Partial<PersonalityState>,
    resultingState: Partial<PersonalityState>
  ): Record<string, number> {
    const progress = { ...currentProgress };
    const initialTraits = initialState.consciousness?.traits || {};
    const resultingTraits = resultingState.consciousness?.traits || {};
  
    Object.keys(resultingTraits).forEach(trait => {
      const initial = initialTraits[trait] || 0;
      const result = resultingTraits[trait] || 0;
      progress[trait] = (progress[trait] || 0) + (result - initial);
    });
  
    return progress;
  }

  private checkStepCompletion(step: TrainingStep, state: PersonalityState): boolean {
    return step.completionCriteria(state);
  }

  private async updateStatusInDB(status: SequenceStatus): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('training_sequences')
        .update({ status })
        .eq('id', status.sequenceId);

      if (error) throw error;
    } catch (error) {
      console.error('Error updating sequence status:', error);
      throw error;
    }
  }

  public async pauseSequence(sequenceId: string): Promise<void> {
    const status = this.activeSequences.get(sequenceId);
    if (status && status.state === 'active') {
      status.state = 'paused';
      await this.updateStatusInDB(status);
    }
  }

  public async resumeSequence(sequenceId: string): Promise<void> {
    const status = this.activeSequences.get(sequenceId);
    if (status && status.state === 'paused') {
      status.state = 'active';
      await this.updateStatusInDB(status);
    }
  }

  public getSequenceStatus(sequenceId: string): SequenceStatus | null {
    return this.activeSequences.get(sequenceId) || null;
  }
}