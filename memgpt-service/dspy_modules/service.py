import dspy
import json
from pathlib import Path
from typing import Dict, Any, Optional, List
from .core import PersonalityModule, teleprompter, PromptManager

class PromptBuilder:
    def __init__(self, personality: PersonalityModule):
        self.personality = personality

    def buildPrompt(self, config: Dict[str, Any]) -> str:
        """Build prompts based on type and configuration"""
        prompt_type = config.get('type', '')
        
        if prompt_type == 'summary':
            return self._build_summary_prompt(config)
        elif prompt_type == 'similarity':
            return self._build_similarity_prompt(config)
        else:
            raise ValueError(f"Unknown prompt type: {prompt_type}")

    def _build_summary_prompt(self, config: Dict[str, Any]) -> str:
        memories = config.get('memories', [])
        style = config.get('style', 'default')
        emotional_state = config.get('emotional_state', 'neutral')
        
        # Get style-specific prompt elements
        style_prompt = self.personality.get_style_prompt(style)
        
        memories_text = "\n".join([
            f"Memory {i+1}: {content}" 
            for i, content in enumerate(memories)
        ])
        
        return f"""Analyze and summarize the following memories:
        Style: {style}
        Emotional State: {emotional_state}
        
        {style_prompt}
        
        Memories to summarize:
        {memories_text}
        
        Provide:
        1. A concise summary
        2. Key points identified
        3. Notable trends or patterns
        
        Format the response as:
        Summary: <summary>
        Key Points: <comma-separated list>
        Trends: <comma-separated list>
        """

    def _build_similarity_prompt(self, config: Dict[str, Any]) -> str:
        source = config.get('source', '')
        candidates = config.get('candidates', [])
        style = config.get('style', 'default')
        emotional_state = config.get('emotional_state', 'neutral')
        
        style_prompt = self.personality.get_style_prompt(style)
        
        candidates_text = "\n".join([
            f"Candidate {i+1}: {content}" 
            for i, content in enumerate(candidates)
        ])
        
        return f"""Compare the similarity between the source content and candidates:
        Style: {style}
        Emotional State: {emotional_state}
        
        {style_prompt}
        
        Source:
        {source}
        
        Candidates:
        {candidates_text}
        
        For each candidate provide:
        1. Similarity score (0-1)
        2. Key insights about the relationship
        
        Format as JSON:
        {{
            "similarities": [scores],
            "insights": {{
                "0": [insights_for_first],
                "1": [insights_for_second],
                ...
            }}
        }}
        """

class DSPyService:
    def __init__(self, prompt_dir: Path, model_config: Dict[str, Any]):
        import openai
        import anthropic
        
        if model_config['model'].startswith('anthropic'):
            # Set up Anthropic client
            self.client = anthropic.Client(api_key=model_config['api_key'])
            
            # Update model name to use correct format for latest Claude
            # Map common model names to their correct identifiers
            model_mapping = {
                'anthropic/claude-2': 'claude-2.1',  # Updated to 2.1
                'anthropic/claude-3': 'claude-3-opus-20240229',  # Latest Claude 3
                'anthropic/claude-3-sonnet': 'claude-3-sonnet-20240229',
                'anthropic/claude-3-haiku': 'claude-3-haiku-20240307'
            }
            
            self.model = model_mapping.get(model_config['model'], 'claude-3-opus-20240229')  # Default to latest if not found
            
            def anthropic_request(prompt: str, **kwargs) -> str:
                try:
                    response = self.client.messages.create(
                        model=self.model,
                        max_tokens=kwargs.get('max_tokens', 4096),  # Increased for Claude 3
                        messages=[{
                            "role": "user",
                            "content": prompt
                        }],
                        temperature=kwargs.get('temperature', 0.7)
                    )
                    return response.content[0].text if response.content else ""
                except Exception as e:
                    print(f"Anthropic API error: {str(e)}")
                    return ""
            
            self.basic_request = anthropic_request
            
        else:
            # Set up OpenAI client
            openai.api_key = model_config['api_key']
            
            # Update OpenAI model mapping as well
            model_mapping = {
                'gpt-4': 'gpt-4-turbo-preview',  # Latest GPT-4
                'gpt-4-turbo': 'gpt-4-turbo-preview',
                'gpt-3.5-turbo': 'gpt-3.5-turbo-0125'  # Latest GPT-3.5
            }
            
            self.model = model_mapping.get(model_config['model'], model_config['model'])
            
            def openai_request(prompt: str, **kwargs) -> str:
                try:
                    response = openai.ChatCompletion.create(
                        model=self.model,
                        max_tokens=kwargs.get('max_tokens', 4096),
                        messages=[{
                            "role": "user",
                            "content": prompt
                        }],
                        temperature=kwargs.get('temperature', 0.7),
                        **{k: v for k, v in kwargs.items() if k not in ['prompt', 'messages', 'model']}
                    )
                    return response.choices[0].message.content
                except Exception as e:
                    print(f"OpenAI API error: {str(e)}")
                    return ""
            
            self.basic_request = openai_request

        # Initialize modules with direct basic_request
        self.personality = PersonalityModule(prompt_dir)
        self.prompt_builder = PromptBuilder(self.personality)
        
        # Configure personality module with our request function
        if hasattr(self.personality, 'predict_step'):
            original_predict_step = self.personality.predict_step
            
            def wrapped_predict_step(prompt: str) -> Any:
                try:
                    response = self.basic_request(prompt)
                    return type('Prediction', (), {
                        'response': response,
                        'metadata': {'model': self.model}
                    })()
                except Exception as e:
                    print(f"Prediction error: {str(e)}")
                    return type('Prediction', (), {
                        'response': '',
                        'metadata': {'error': str(e)}
                    })()
            
            self.personality.predict_step = wrapped_predict_step
        
        # Store model config
        self.model_config = model_config
        
        # Load example data for training
        self.load_examples()

    def load_examples(self):
        """Load training examples for bootstrapping"""
        self.examples = []
        if self.examples:
            teleprompter.bootstrap(
                self.personality,
                self.examples,
                metric='exact_match'
            )
    
    async def predict_with_retry(self, prompt: str, max_retries: int = 3) -> str:
        """Helper method to make predictions with retry logic"""
        for attempt in range(max_retries):
            try:
                return self.basic_request(prompt)
            except Exception as e:
                if attempt == max_retries - 1:
                    print(f"Failed prediction after {max_retries} attempts: {str(e)}")
                    return ""
                continue
        return ""

    async def generate_response(self,
                              input_text: str,
                              emotional_state: str,
                              style: str,
                              context: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """Generate a response using the DSPy personality module"""
        try:
            prompt = self.prompt_builder.buildPrompt({
                'type': 'response',
                'content': input_text,
                'style': style,
                'emotional_state': emotional_state,
                'context': context
            })
            
            response = await self.predict_with_retry(prompt)
            
            return {
                'success': True,
                'data': {
                    'response': response,
                    'metadata': {
                        'style': style,
                        'emotional_state': emotional_state
                    }
                }
            }
            
        except Exception as e:
            return {
                'success': False,
                'error': str(e)
            }

    async def generate_summary(self, memories: List[Dict], style: str, emotional_state: str) -> Dict[str, Any]:
        """Generate a summary of memories using DSPy"""
        try:
            # Create a prompt for summarization
            prompt = self.prompt_builder.buildPrompt({
                'type': 'summary',
                'memories': [m.get('content', '') for m in memories],
                'style': style,
                'emotional_state': emotional_state
            })

            # Use the personality module's predict_step method
            result = self.personality.predict_step(prompt)
            
            # Parse the response
            response_lines = result.response.split('\n')
            summary = []
            key_points = []
            trends = []
            current_section = None
            
            for line in response_lines:
                line = line.strip()
                if line.startswith('Summary:'):
                    current_section = 'summary'
                    summary.append(line.replace('Summary:', '').strip())
                elif line.startswith('Key Points:'):
                    current_section = 'key_points'
                    points = line.replace('Key Points:', '').strip()
                    if points:
                        key_points.extend([p.strip() for p in points.split(',')])
                elif line.startswith('Trends:'):
                    current_section = 'trends'
                    trend_list = line.replace('Trends:', '').strip()
                    if trend_list:
                        trends.extend([t.strip() for t in trend_list.split(',')])
                elif line and current_section:
                    if current_section == 'summary':
                        summary.append(line)
                    elif current_section == 'key_points':
                        key_points.extend([p.strip() for p in line.split(',')])
                    elif current_section == 'trends':
                        trends.extend([t.strip() for t in line.split(',')])
                
            return {
                'success': True,
                'data': {
                    'summary': ' '.join(summary),
                    'key_points': [p for p in key_points if p],
                    'trends': [t for t in trends if t]
                }
            }
        except Exception as e:
            print(f"Error generating DSPy summary: {str(e)}")
            return {
                'success': False,
                'error': str(e)
            }

    async def find_related(
        self, 
        source_content: str,
        candidates: List[str] = None,
        limit: int = 5,
        context: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """Find related content using DSPy's semantic understanding"""
        try:
            emotional_state = context.get('emotional_state', 'neutral') if context else 'neutral'
            style = context.get('style', 'default') if context else 'default'

            if candidates is None:
                candidates = []

            # Create a prompt for finding related content
            prompt = self.prompt_builder.buildPrompt({
                'type': 'similarity',
                'source': source_content,
                'candidates': candidates,
                'style': style,
                'emotional_state': emotional_state
            })

            # Use the personality module's predict_step method
            result = self.personality.predict_step(prompt)
            
            try:
                # Try to parse JSON from the response
                parsed_result = json.loads(result.response)
                
                # Process and score results
                scored_results = []
                for idx, candidate in enumerate(candidates):
                    score = parsed_result.get('similarities', [])[idx] if parsed_result.get('similarities') else 0
                    scored_results.append({
                        'content': candidate,
                        'dspy_score': float(score),
                        'insights': parsed_result.get('insights', {}).get(str(idx), [])
                    })

                # Sort by score and limit results
                sorted_results = sorted(
                    scored_results, 
                    key=lambda x: x['dspy_score'], 
                    reverse=True
                )[:limit]

                return {
                    'success': True,
                    'data': {
                        'memories': sorted_results,
                        'insights': parsed_result.get('insights', {}),
                        'analysis': parsed_result.get('analysis', {})
                    }
                }
            except json.JSONDecodeError:
                return {
                    'success': False,
                    'error': 'Failed to parse similarity results'
                }
                
        except Exception as e:
            print(f"Error finding related content with DSPy: {str(e)}")
            return {
                'success': False,
                'error': str(e)
            }
        
    async def analyze_trading_command(
        self,
        message: str,
        context: str = "default"
    ) -> Dict[str, Any]:
        """Analyze trading chat messages to determine command type and parameters"""
        try:
            # Build a prompt for command analysis
            prompt = f"""Analyze the following trading message and determine the command type and parameters:

Message: {message}
Context: {context}

Command Types:
- TRADE: For trade execution requests
- ANALYSIS: For market analysis requests
- SETTINGS: For system settings changes
- PORTFOLIO: For portfolio information requests
- SYSTEM: For system maintenance commands

Respond in JSON format:
{{
    "command_type": "<command_type>",
    "parameters": {{
        // Extracted parameters based on command type
    }}
}}
"""

            # Get response from language model
            result = await self.predict_with_retry(prompt)

            try:
                # Parse JSON response
                parsed_result = json.loads(result)
                return {
                    "command_type": parsed_result.get("command_type", "SYSTEM"),
                    "parameters": parsed_result.get("parameters", {})
                }
            except json.JSONDecodeError:
                # If greeting or casual message, return default response
                if any(word in message.lower() for word in ['hi', 'hello', 'hey', 'greetings']):
                    return {
                        "command_type": "SYSTEM",
                        "parameters": {
                            "action": "greet",
                            "message": "Hello! I'm your AI trading assistant. How can I help you today?"
                        }
                    }
                return {
                    "command_type": "SYSTEM",
                    "parameters": {
                        "action": "unknown",
                        "original_message": message
                    }
                }

        except Exception as e:
            print(f"Error analyzing trading command: {str(e)}")
            return {
                "command_type": "SYSTEM",
                "parameters": {
                    "action": "error",
                    "error": str(e)
                }
            }
            
    async def optimize_response(self,
                              input_text: str,
                              target_style: str,
                              feedback: Dict[str, Any]) -> Dict[str, Any]:
        """Optimize responses based on feedback"""
        try:
            # Use teleprompter to optimize based on feedback
            optimized = teleprompter.optimize(
                self.personality,
                input_text,
                target_style,
                metric_feedback=feedback
            )
            
            return {
                'success': True,
                'data': {
                    'optimized_response': optimized.response,
                    'improvements': optimized.reasoning
                }
            }
        except Exception as e:
            return {
                'success': False,
                'error': str(e)
            }