# dspy_modules/core.py
import dspy
import json
from pathlib import Path
from typing import Dict, Any, Optional, List
import re
import ast

class TypeScriptParser:
    """A more robust TypeScript parser for prompt files"""
    
    @staticmethod
    def parse_enum(content: str, enum_name: str) -> Dict[str, str]:
        """Parse a TypeScript enum into a Python dict"""
        pattern = f"export enum {enum_name} {{([^}}]*)}}"
        match = re.search(pattern, content, re.DOTALL)
        if not match:
            return {}
            
        enum_content = match.group(1)
        enum_dict = {}
        
        # Parse each enum entry
        for line in enum_content.strip().split('\n'):
            line = line.strip()
            if line and '=' in line:
                key, value = line.split('=', 1)
                key = key.strip()
                value = value.strip().rstrip(',').strip("'").strip('"')
                enum_dict[key] = value
                
        return enum_dict

    @staticmethod
    def parse_const_object(content: str, const_name: str) -> Dict[str, Any]:
        """Parse a TypeScript const object into a Python dict"""
        pattern = f"export const {const_name}[^=]*= ({{[^;]*}}) as const;"
        match = re.search(pattern, content, re.DOTALL | re.MULTILINE)
        if not match:
            return {}
        
        try:
            # Get the object content
            ts_object = match.group(1)
            
            # First cleanup: Remove TypeScript type annotations
            ts_object = re.sub(r': Record<[^>]+>', '=', ts_object)
            
            # Handle TweetStyle enum references with proper dictionary format
            ts_object = re.sub(r'\[TweetStyle\.(\w+)\]:', r'"\1":', ts_object)
            
            # Convert TypeScript array syntax to Python
            ts_object = ts_object.replace('[', '["').replace(']', '"]')
            ts_object = ts_object.replace('["chaotic"', "['chaotic'")
            ts_object = ts_object.replace('["analytical"', "['analytical'")
            ts_object = ts_object.replace('["philosophical"', "['philosophical'")
            ts_object = ts_object.replace('["energetic"', "['energetic'")
            ts_object = ts_object.replace('["suggestive"', "['suggestive'")
            
            # Convert the rest of the syntax to Python
            py_object = ts_object.replace('traits:', '"traits":')
            py_object = py_object.replace('energyLevel:', '"energyLevel":')
            py_object = py_object.replace('chaosThreshold:', '"chaosThreshold":')
            
            # Clean up any trailing commas before closing braces
            py_object = re.sub(r',(\s*})', r'\1', py_object)
            
            # Parse the Python dictionary
            return ast.literal_eval(py_object)
            
        except Exception as e:
            print(f"Error parsing {const_name}: {e}")
            print(f"Attempted to parse: {ts_object if 'ts_object' in locals() else 'No content found'}")
            return {}

    @staticmethod
    def parse_template_string(content: str, variable_name: str) -> str:
        """Parse a TypeScript template string into a Python string"""
        # Look for both const and static readonly declarations
        patterns = [
            f"const {variable_name}\\s*=\\s*`([^`]*)`",
            f"static readonly {variable_name}\\s*=\\s*`([^`]*)`",
            f"private static readonly {variable_name}\\s*=\\s*`([^`]*)`"
        ]
        
        for pattern in patterns:
            match = re.search(pattern, content, re.DOTALL)
            if match:
                return match.group(1).strip()
        
        return ""
    
class PromptManager:
    """Manages loading and parsing TypeScript prompt files"""
    
    def __init__(self, prompt_dir: Path):
        self.prompt_dir = prompt_dir
        self.parser = TypeScriptParser()
        self.styles: Dict[str, Any] = {}
        self.prompts: Dict[str, str] = {}
        self.config: Dict[str, Any] = {}
        
    def load_file(self, relative_path: str) -> str:
        """Load a file from the prompts directory"""
        file_path = self.prompt_dir / relative_path
        if not file_path.exists():
            raise FileNotFoundError(f"Prompt file not found: {file_path}")
            
        with open(file_path, 'r', encoding='utf-8') as f:
            return f.read()

    def load_styles(self):
        """Load tweet styles and configurations"""
        content = self.load_file('styles/tweet-styles.ts')
        
        # Parse TweetStyle enum
        styles_enum = self.parser.parse_enum(content, 'TweetStyle')
        
        # Parse STYLE_TRAITS const
        style_traits = self.parser.parse_const_object(content, 'STYLE_TRAITS')
        
        # Combine them
        self.styles = {
            'enum': styles_enum,
            'traits': style_traits
        }

    def load_prompts(self):
        """Load all prompt templates"""
        personality_content = self.load_file('builders/personality-prompt.ts')
        
        # Load all template strings
        template_vars = [
            'PERSONALITY_CORE_TRAITS',
            'TWEET_STYLES',
            'TWEET_RULES',
            'CRITICAL_RULES'
        ]
        
        for var in template_vars:
            self.prompts[var] = self.parser.parse_template_string(
                personality_content, var
            )

    def get_style_config(self, style: str) -> Dict[str, Any]:
        """Get configuration for a specific style"""
        if not self.styles:
            self.load_styles()
            
        style_key = f'[TweetStyle.{style}]'
        return self.styles.get('traits', {}).get(style_key, {})

    def get_prompt(self, name: str) -> str:
        """Get a specific prompt template"""
        if not self.prompts:
            self.load_prompts()
            
        return self.prompts.get(name, "")

class PersonalityModule(dspy.Module):
    """Core personality module that integrates with existing prompts"""
    
    def __init__(self, prompt_dir: Path):
        super().__init__()
        self.prompt_manager = PromptManager(prompt_dir)
        
        # Load all prompts and styles
        self.prompt_manager.load_styles()
        self.prompt_manager.load_prompts()
        
        # Basic prediction configuration
        self.predictor = None  # We'll use dspy.settings.lm directly
        
        # Create a simple module that doesn't rely on kwargs
        class DirectPredictor(dspy.Module):
            def __init__(self):
                super().__init__()
                self.base_predictor = dspy.Predict("input -> output")
            
            def forward(self, text):
                try:
                    # Call the predictor directly with dictionary
                    kwargs = {"input": text}
                    return self.base_predictor.forward(**kwargs)
                except Exception as e:
                    print(f"DirectPredictor error: {str(e)}")
                    return type('Prediction', (), {'output': text, 'reasoning': None})()
        
        self.predictor = DirectPredictor()
        
    def get_style_prompt(self, style: str) -> str:
        """Get the complete prompt for a style"""
        style_config = self.prompt_manager.get_style_config(style)
        core_traits = self.prompt_manager.get_prompt('PERSONALITY_CORE_TRAITS')
        rules = self.prompt_manager.get_prompt('TWEET_RULES')
        critical_rules = self.prompt_manager.get_prompt('CRITICAL_RULES')
        
        return f"""Style Configuration:
Traits: {', '.join(style_config.get('traits', []))}
Energy Level: {style_config.get('energyLevel', 0.5)}
Chaos Threshold: {style_config.get('chaosThreshold', 0.5)}

{core_traits}

{rules}

{critical_rules}"""

    def predict_step(self, prompt: str) -> dspy.Prediction:
        """Single prediction step using basic LM completion"""
        try:
            # Get the LM from settings
            lm = dspy.settings.lm
            if not lm:
                raise ValueError("No language model configured")
                
            # Create a basic completion request
            completion = lm.basic_request(
                prompt,
                temperature=0.7,
                max_tokens=100
            )
            
            # Extract the response text
            response_text = completion.strip() if completion else prompt
            
            return dspy.Prediction(
                response=response_text,
                reasoning=None,
                metadata={
                    'input': prompt,
                    'raw_output': response_text
                }
            )
        except Exception as e:
            print(f"Basic prediction error: {str(e)}")
            return dspy.Prediction(
                response=prompt,
                reasoning=None,
                metadata={'error': str(e)}
            )
        
    def forward(self, 
                input_text: str,
                emotional_state: str,
                style: str,
                context: Optional[Dict[str, Any]] = None) -> dspy.Prediction:
        """Generate a response using multi-step reasoning"""
        
        # Get complete style-specific prompt
        style_prompt = self.get_style_prompt(style)
        
        try:
            # Step 1: Analyze context and emotional state
            analysis_prompt = f"""Analyze the input and determine appropriate response approach.
                Input: {input_text}
                Emotional State: {emotional_state}
                Style: {style}
                
                {style_prompt}
                
                Think through step by step:
                1. What is the key message or topic?
                2. How does the emotional state affect our response?
                3. What style elements should we emphasize?
                4. What unique perspective can we add?
                
                Response:"""
                
            analysis = self.predict_step(analysis_prompt)
            
            # Step 2: Generate response using analysis
            response_prompt = f"""Generate a response based on the analysis.
                Analysis: {analysis.response}
                
                {style_prompt}
                
                Generate a response that:
                1. Matches the determined style
                2. Incorporates the emotional state
                3. Adds unique value or perspective
                4. Follows all critical rules
                
                Response:"""
                
            response = self.predict_step(response_prompt)
            
            return dspy.Prediction(
                response=response.response,
                reasoning=analysis.response,
                metadata={
                    'style': style,
                    'emotional_state': emotional_state,
                    'style_config': self.prompt_manager.get_style_config(style),
                    'analysis': analysis
                }
            )
        except Exception as e:
            print(f"Forward error: {str(e)}")
            return dspy.Prediction(
                response="",
                reasoning=None,
                metadata={'error': str(e)}
            )

# Initialize teleprompter for response optimization
teleprompter = dspy.teleprompt.BootstrapFewShot(metric='exact_match')