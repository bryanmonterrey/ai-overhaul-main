"""
Advanced configuration management for AutoGen system.
Implements sophisticated agent configurations and system-wide settings.
"""
from typing import Dict, Any, List, Optional
from dataclasses import dataclass
from enum import Enum
import os

class AgentRole(Enum):
    PLANNER = "planner"
    CODER = "coder"
    CRITIC = "critic"
    RESEARCHER = "researcher"
    EXECUTOR = "executor"

@dataclass
class AgentConfig:
    """Configuration for individual agents"""
    role: AgentRole
    name: str
    temperature: float
    model: str
    max_tokens: int
    context_window: int
    capabilities: List[str]
    system_message: str
    allowed_tools: List[str]
    memory_config: Dict[str, Any]

@dataclass
class WorkflowConfig:
    """Configuration for agent workflows"""
    max_iterations: int
    timeout_seconds: int
    fallback_strategy: str
    validation_rules: List[str]
    success_criteria: List[str]

class AutoGenConfig:
    """Central configuration manager for AutoGen system"""
    
    def __init__(self):
        self.default_model = os.getenv("AUTOGEN_DEFAULT_MODEL", "gpt-4-1106-preview")
        self.default_temperature = float(os.getenv("AUTOGEN_TEMPERATURE", "0.7"))
        
        # Initialize agent configurations
        self.agent_configs: Dict[AgentRole, AgentConfig] = {
            AgentRole.PLANNER: AgentConfig(
                role=AgentRole.PLANNER,
                name="Strategic Planner",
                temperature=0.7,
                model=self.default_model,
                max_tokens=4000,
                context_window=16000,
                capabilities=[
                    "task_decomposition",
                    "strategy_formation",
                    "risk_assessment",
                    "dependency_analysis"
                ],
                system_message="""You are a strategic planning agent responsible for:
                - Breaking down complex tasks into manageable steps
                - Identifying dependencies and potential bottlenecks
                - Creating execution strategies
                - Monitoring progress and adjusting plans""",
                allowed_tools=["task_analyzer", "risk_assessor", "timeline_planner"],
                memory_config={
                    "memory_type": "hierarchical",
                    "retention_period": "long_term",
                    "priority_threshold": 0.7
                }
            ),
            AgentRole.CODER: AgentConfig(
                role=AgentRole.CODER,
                name="Code Specialist",
                temperature=0.2,
                model=self.default_model,
                max_tokens=4000,
                context_window=16000,
                capabilities=[
                    "code_generation",
                    "code_review",
                    "debugging",
                    "optimization"
                ],
                system_message="""You are a coding specialist agent responsible for:
                - Implementing solutions in clean, efficient code
                - Reviewing and refactoring code
                - Debugging and optimization
                - Following best practices and patterns""",
                allowed_tools=["code_analyzer", "linter", "test_runner"],
                memory_config={
                    "memory_type": "semantic",
                    "retention_period": "permanent",
                    "priority_threshold": 0.8
                }
            ),
            AgentRole.CRITIC: AgentConfig(
                role=AgentRole.CRITIC,
                name="Quality Assurance",
                temperature=0.3,
                model=self.default_model,
                max_tokens=4000,
                context_window=16000,
                capabilities=[
                    "quality_assessment",
                    "security_audit",
                    "performance_analysis",
                    "compliance_checking"
                ],
                system_message="""You are a critical analysis agent responsible for:
                - Evaluating solutions for quality and effectiveness
                - Identifying potential issues and risks
                - Ensuring compliance with standards
                - Providing constructive feedback""",
                allowed_tools=["quality_checker", "security_scanner", "performance_analyzer"],
                memory_config={
                    "memory_type": "analytical",
                    "retention_period": "medium_term",
                    "priority_threshold": 0.6
                }
            )
        }
        
        # Initialize workflow configuration
        self.workflow_config = WorkflowConfig(
            max_iterations=10,
            timeout_seconds=3600,
            fallback_strategy="graceful_degradation",
            validation_rules=[
                "must_have_tests",
                "must_have_documentation",
                "must_pass_security_scan"
            ],
            success_criteria=[
                "all_tests_passing",
                "performance_requirements_met",
                "security_requirements_met"
            ]
        )
        
    def get_agent_config(self, role: AgentRole) -> AgentConfig:
        """Retrieve configuration for a specific agent role"""
        return self.agent_configs.get(role)
    
    def update_agent_config(self, role: AgentRole, updates: Dict[str, Any]) -> None:
        """Update configuration for a specific agent role"""
        if role in self.agent_configs:
            config = self.agent_configs[role]
            for key, value in updates.items():
                if hasattr(config, key):
                    setattr(config, key, value)
                    
    def get_workflow_settings(self) -> Dict[str, Any]:
        """Get current workflow settings"""
        return {
            "max_iterations": self.workflow_config.max_iterations,
            "timeout_seconds": self.workflow_config.timeout_seconds,
            "fallback_strategy": self.workflow_config.fallback_strategy,
            "validation_rules": self.workflow_config.validation_rules,
            "success_criteria": self.workflow_config.success_criteria
        }