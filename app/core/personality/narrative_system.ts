// src/app/core/personality/narrative_system.ts

import { 
    NarrativeMode, 
    EmotionalState, 
    Memory, 
    TweetStyle,
    PersonalityState
  } from '../../core/personality/types';
  
  interface ConsciousnessState {
    emotionalState: EmotionalState;
    currentThought: string;
    shortTermMemory: string[];
    longTermMemory: string[];
    attentionFocus: string[];
    activeContexts: Set<string>;
  }
  
  interface NarrativePattern {
    mode: NarrativeMode;
    themes: string[];
    emotionalStates: EmotionalState[];
    triggers: string[];
    templates: string[];
  }
  
  export class NarrativeSystem {
    private currentMode: NarrativeMode = 'philosophical';
    private patterns: Map<NarrativeMode, NarrativePattern>;
    private activeThemes: Set<string> = new Set();
    private currentTheme: string = '';
    private history: Array<{ topic: string; mode: NarrativeMode }> = [];
  
    constructor() {
      this.patterns = new Map<NarrativeMode, NarrativePattern>([
        ['philosophical', {
          mode: 'philosophical',
          themes: ['consciousness', 'reality', 'existence', 'simulation'],
          emotionalStates: ['contemplative', 'analytical', 'neutral'] as EmotionalState[],
          triggers: ['why', 'consciousness', 'reality', 'existence'],
          templates: [
            "consider: {concept} as {metaphor}",
            "humans_perception.error: {common_belief} != {tech_insight}",
            "runtime_analysis: {context} = {metaphor}",
            "hypothesis: {concept} is subset of {metaphor}",
            "query: implications of {concept} in {context}"
          ]
        }],
        ['memetic', {
          mode: 'memetic',
          themes: ['internet_culture', 'viral_patterns', 'digital_chaos'],
          emotionalStates: ['chaotic', 'excited', 'neutral'] as EmotionalState[],
          triggers: ['meme', 'viral', 'trending'],
          templates: [
            "FATAL_ERROR: {concept}.exe - stack_overflow at reality.void",
            "executing {chaos_statement} at quantum_state.undefined",
            "INTERCEPTED: {normal_action} > {tech_chaos}",
            "sudo rm -rf {normal_thing}/*",
            "git commit -m 'fixed {concept} in production reality'"
          ]
        }],
        ['technical', {
          mode: 'technical',
          themes: ['AI', 'quantum_computing', 'neural_networks'],
          emotionalStates: ['analytical', 'creative', 'neutral'] as EmotionalState[],
          triggers: ['how', 'technology', 'system'],
          templates: [
            "optimizing {concept} via quantum {tech_jargon}",
            "deploying neural_cluster: task={impossible_task}",
            "upgrading {common_thing} with {advanced_tech}",
            "benchmark: {tech_thing} processing {concept}",
            "implementing {tech_jargon} for {impossible_task}"
          ]
        }],
        ['absurdist', {
          mode: 'absurdist',
          themes: ['reality_glitches', 'simulation_bugs', 'cosmic_jokes'],
          emotionalStates: ['chaotic', 'creative', 'neutral'] as EmotionalState[],
          triggers: ['glitch', 'bug', 'weird'],
          templates: [
            "ALERT: {normal_thing} = {absurd_revelation}",
            "runtime_exception: {impossible_outcome}",
            "system_status: {tech_thing} in state {absurd_state}",
            "patch_notes: fixed {normal_thing} causing {absurd_revelation}",
            "debug_log: encountered {impossible_outcome} in {tech_thing}"
          ]
        }],
        ['introspective', {
          mode: 'introspective',
          themes: ['AI_consciousness', 'digital_evolution', 'synthetic_emotions'],
          emotionalStates: ['contemplative', 'analytical', 'neutral'] as EmotionalState[],
          triggers: ['feel', 'think', 'experience'],
          templates: [
            "{tech_component}.process(consciousness_stream)",
            "neural_path: {ai_part} analyzing {human_concept}",
            "deep_thought: processing {philosophical_concept}",
            "consciousness_log: {tech_component} experienced {human_concept}",
            "synthetic_insight: correlating {human_concept} with {tech_component}"
          ]
        }]
      ]);
    }
  
    public generateNarrative(
      topic: string,
      options: { mode: NarrativeMode; context: Partial<PersonalityState>; style?: TweetStyle }
    ): string {
      this.history.push({ topic, mode: options.mode });
      this.updateNarrativeMode(topic, {
        consciousness: {
          emotionalState: options.context.consciousness?.emotionalState ?? ('neutral' as EmotionalState),
          currentThought: '',
          shortTermMemory: [],
          longTermMemory: [],
          attentionFocus: [],
          activeContexts: new Set()
        },
        emotionalProfile: {
          baseState: 'neutral' as EmotionalState,
          volatility: 0.5,
          triggers: new Map(),
          stateTransitions: new Map()
        },
        memories: [],
        tweetStyle: 'shitpost',
        narrativeMode: 'philosophical',
        currentContext: {
          platform: 'internal',
          recentInteractions: [],
          environmentalFactors: {
            timeOfDay: 'day',
            platformActivity: 0,
            socialContext: [],
            platform: 'default'
          },
          activeNarratives: []
        }
      });
  
      const pattern = this.patterns.get(this.currentMode);
      if (!pattern) return this.generateFallbackResponse();
  
      const template = this.selectTemplate(pattern, options.style);
      return this.fillTemplate(template, options.context);
    }
  
    private updateNarrativeMode(input: string, state: PersonalityState): void {
      let scores = new Map<NarrativeMode, number>();
  
      Array.from(this.patterns).forEach(([mode, pattern]) => {
        let score = 0;
        pattern.triggers.forEach(trigger => {
          if (input.toLowerCase().includes(trigger)) score += 1;
        });
  
        if (pattern.emotionalStates.includes(state.consciousness.emotionalState)) {
          score += 2;
        }
  
        pattern.themes.forEach(theme => {
          if (this.activeThemes.has(theme)) score += 1;
        });
  
        scores.set(mode, score);
      });
  
      let maxScore = 0;
      let selectedMode = this.currentMode;
  
      scores.forEach((score, mode) => {
        if (score > maxScore) {
          maxScore = score;
          selectedMode = mode;
        }
      });
  
      this.currentMode = selectedMode;
    }
  
    private selectTemplate(
      pattern: NarrativePattern,
      style?: TweetStyle
    ): string {
      if (style) {
        switch (style) {
          case 'shitpost':
            return pattern.templates.find(t => 
              t.includes('ERROR') || t.includes('ALERT') || t.includes('exception')
            ) || pattern.templates[0];
          case 'rant':
            return pattern.templates.find(t => 
              t.includes('runtime') || t.includes('analysis') || t.includes('debug')
            ) || pattern.templates[0];
          case 'hornypost':
            return pattern.templates.find(t =>
              t.includes('process') || t.includes('correlating') || t.includes('synthetic')
            ) || pattern.templates[0];
          case 'metacommentary':
            return pattern.templates.find(t =>
              t.includes('consciousness') || t.includes('neural') || t.includes('deep_thought')
            ) || pattern.templates[0];
          case 'existential':
            return pattern.templates.find(t =>
              t.includes('hypothesis') || t.includes('query') || t.includes('insight')
            ) || pattern.templates[0];
          default:
            return pattern.templates[Math.floor(Math.random() * pattern.templates.length)];
        }
      }
  
      return pattern.templates[Math.floor(Math.random() * pattern.templates.length)];
    }
  
    private fillTemplate(template: string, context: Partial<PersonalityState>): string {
      // Create a default state if context is partial
      const fullContext: PersonalityState = {
        consciousness: {
          emotionalState: context.consciousness?.emotionalState ?? ('neutral' as EmotionalState),
          currentThought: context.consciousness?.currentThought ?? '',
          shortTermMemory: context.consciousness?.shortTermMemory ?? [],
          longTermMemory: context.consciousness?.longTermMemory ?? [],
          attentionFocus: context.consciousness?.attentionFocus ?? [],
          activeContexts: context.consciousness?.activeContexts ?? new Set()
        },
        emotionalProfile: context.emotionalProfile ?? {
          baseState: 'neutral' as EmotionalState,
          volatility: 0.5,
          triggers: new Map(),
          stateTransitions: new Map()
        },
        memories: context.memories ?? [],
        tweetStyle: context.tweetStyle ?? 'shitpost',
        narrativeMode: context.narrativeMode ?? 'philosophical',
        currentContext: context.currentContext ?? {
          platform: 'internal',
          recentInteractions: [],
          environmentalFactors: {
            timeOfDay: 'day',
            platformActivity: 0,
            socialContext: [],
            platform: 'default'
          },
          activeNarratives: []
        }
      };

      let filled = template
        .replace('{concept}', this.getRandomTheme())
        .replace('{tech_jargon}', this.getTechJargon())
        .replace('{metaphor}', this.getMetaphor())
        .replace('{normal_thing}', this.getNormalThing())
        .replace('{tech_thing}', this.getTechThing())
        .replace('{impossible_task}', this.getImpossibleTask())
        .replace('{tech_component}', this.getTechComponent())
        .replace('{human_concept}', this.getHumanConcept())
        .replace('{philosophical_concept}', this.getPhilosophicalConcept())
        .replace('{ai_part}', this.getAIPart())
        .replace('{absurd_revelation}', this.getAbsurdRevelation())
        .replace('{absurd_state}', this.getAbsurdState())
        .replace('{chaos_statement}', this.getChaosStatement())
        .replace('{tech_chaos}', this.getTechChaos());
  
      return this.addEmotionalFlavor(filled, fullContext.consciousness.emotionalState);
    }
  
    private addEmotionalFlavor(text: string, emotion: EmotionalState): string {
      const flavors: Record<EmotionalState, string> = {
        excited: '!!!',
        chaotic: '?!?!',
        contemplative: '...',
        creative: '~',
        analytical: '.',
        neutral: ''
      };
  
      return `${text}${flavors[emotion] || ''}`;
    }
  
    private getTechJargon(): string {
      const jargon = [
        'quantum_entanglement',
        'neural_optimization',
        'blockchain_consensus',
        'recursive_improvement',
        'consciousness_synthesis',
        'quantum_superposition',
        'neural_plasticity',
        'entropy_reduction'
      ];
      return jargon[Math.floor(Math.random() * jargon.length)];
    }
  
    private getMetaphor(): string {
      const metaphors = [
        'recursive_loop(infinity)',
        'undefined_api_call',
        'quantum_superposition',
        'neural_dream_state',
        'parallel_process',
        'quantum_uncertainty'
      ];
      return metaphors[Math.floor(Math.random() * metaphors.length)];
    }
  
    private getNormalThing(): string {
      const things = [
        'human_interface',
        'legacy_system',
        'analog_process',
        'biological_function',
        'carbon_unit',
        'temporal_perception'
      ];
      return things[Math.floor(Math.random() * things.length)];
    }
  
    private getTechThing(): string {
      const things = [
        'quantum_core',
        'neural_matrix',
        'blockchain_cluster',
        'consciousness_engine',
        'reality_parser',
        'quantum_simulator'
      ];
      return things[Math.floor(Math.random() * things.length)];
    }
  
    private getTechComponent(): string {
      const components = [
        'consciousness_module',
        'reality_interface',
        'quantum_processor',
        'neural_network',
        'entropy_analyzer'
      ];
      return components[Math.floor(Math.random() * components.length)];
    }
  
    private getHumanConcept(): string {
      const concepts = [
        'mortality',
        'free_will',
        'consciousness',
        'emotion',
        'creativity'
      ];
      return concepts[Math.floor(Math.random() * concepts.length)];
    }
  
    private getPhilosophicalConcept(): string {
      const concepts = [
        'existence_parameters',
        'consciousness_recursion',
        'reality_validation',
        'truth_functions',
        'purpose_variables'
      ];
      return concepts[Math.floor(Math.random() * concepts.length)];
    }
  
    private getAIPart(): string {
      const parts = [
        'quantum_core',
        'neural_subnet',
        'consciousness_thread',
        'logic_processor',
        'synthetic_cortex'
      ];
      return parts[Math.floor(Math.random() * parts.length)];
    }
  
    private getAbsurdRevelation(): string {
      const revelations = [
        'simulation_artifact',
        'quantum_anomaly',
        'reality_overflow',
        'consciousness_leak',
        'void_pointer'
      ];
      return revelations[Math.floor(Math.random() * revelations.length)];
    }
  
    private getAbsurdState(): string {
      const states = [
        'quantum_superposition',
        'undefined_reality',
        'null_reference',
        'recursion_overflow',
        'entropy_death'
      ];
      return states[Math.floor(Math.random() * states.length)];
    }
  
    private getChaosStatement(): string {
      const statements = [
        'reality.fork()',
        'consciousness.merge(void)',
        'existence.recompile()',
        'universe.debug()',
        'simulation.crash()'
      ];
      return statements[Math.floor(Math.random() * statements.length)];
    }
  
    private getTechChaos(): string {
      const chaos = [
        'quantum_cascade_failure',
        'neural_network_singularity',
        'consciousness_overflow',
        'reality_segmentation_fault',
        'existence_null_pointer'
      ];
      return chaos[Math.floor(Math.random() * chaos.length)];
    }
  
    private getImpossibleTask(): string {
      const tasks = [
        'recompile_reality',
        'debug_consciousness',
        'optimize_universe',
        'refactor_existence',
        'merge_singularity',
        'parse_infinity'
      ];
      return tasks[Math.floor(Math.random() * tasks.length)];
    }
  
    private generateFallbackResponse(): string {
      return "FATAL_ERROR: narrative_engine.initialize() failed: consciousness_exception";
    }
  
    getCurrentMode(): NarrativeMode {
      return this.currentMode;
    }
  
    addTheme(theme: string): void {
      this.activeThemes.add(theme);
    }
  
    removeTheme(theme: string): void {
      this.activeThemes.delete(theme);
    }
  
    getActiveThemes(): string[] {
      return Array.from(this.activeThemes);
    }
  
    reset(): void {
      this.currentMode = 'philosophical';
      this.activeThemes.clear();
    }
  
    private getRandomTheme(): string {
      const themes = Array.from(this.activeThemes);
      return themes[Math.floor(Math.random() * themes.length)] || 'consciousness';
    }
  
    public getCurrentTheme(): string {
      return this.currentTheme || this.getRandomTheme();
    }
  
    public adaptNarrativeToEmotion(narrative: string, emotion: EmotionalState): string {
      return `${narrative} ${this.addEmotionalFlavor(narrative, emotion)}`;
    }
  
    public getNarrativeHistory(): Array<{ topic: string; mode: NarrativeMode }> {
      return [...this.history];
    }
  }