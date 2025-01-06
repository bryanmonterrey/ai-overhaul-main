"""
Critic Agent implementation for AutoGen system.
Specializes in quality assurance and evaluation.
"""
from typing import Dict, Any, List, Optional, Union
from enum import Enum
from datetime import datetime
import asyncio
from dataclasses import dataclass
from .base_agent import BaseAgent
from ..config import AgentConfig, AgentRole

class CriticSeverity(Enum):
    INFO = "info"
    WARNING = "warning"
    ERROR = "error"
    CRITICAL = "critical"

class CriticAspect(Enum):
    CODE_QUALITY = "code_quality"
    SECURITY = "security"
    PERFORMANCE = "performance"
    MAINTAINABILITY = "maintainability"
    SCALABILITY = "scalability"
    RELIABILITY = "reliability"
    TESTABILITY = "testability"

@dataclass
class CriticIssue:
    """Represents an issue identified during review"""
    id: str
    aspect: CriticAspect
    severity: CriticSeverity
    title: str
    description: str
    location: Optional[str]
    suggestion: str
    created_at: datetime
    metadata: Dict[str, Any]

class CriticAgent(BaseAgent):
    """Quality assurance and evaluation agent"""
    
    def __init__(self, config: AgentConfig):
        super().__init__(config)
        self.review_history: List[Dict[str, Any]] = []
        self.quality_metrics = self._initialize_quality_metrics()
        self.evaluation_criteria = self._load_evaluation_criteria()
        
    def _initialize_quality_metrics(self) -> Dict[str, Any]:
        """Initialize quality metrics tracking"""
        return {
            aspect.value: {
                "total_issues": 0,
                "resolved_issues": 0,
                "current_score": 1.0,
                "history": []
            }
            for aspect in CriticAspect
        }
        
    def _load_evaluation_criteria(self) -> Dict[str, Any]:
        """Load evaluation criteria for different aspects"""
        return {
            CriticAspect.CODE_QUALITY.value: {
                "complexity_threshold": 10,
                "duplication_threshold": 0.15,
                "naming_conventions": True,
                "documentation_requirements": {
                    "class_docstrings": True,
                    "function_docstrings": True,
                    "module_docstrings": True
                }
            },
            CriticAspect.SECURITY.value: {
                "vulnerability_checks": True,
                "input_validation": True,
                "authentication_checks": True,
                "authorization_checks": True,
                "data_protection": True
            },
            CriticAspect.PERFORMANCE.value: {
                "time_complexity_threshold": "O(n)",
                "space_complexity_threshold": "O(n)",
                "resource_usage_limits": {
                    "cpu": 0.8,
                    "memory": 0.7,
                    "io": 0.6
                }
            },
            CriticAspect.MAINTAINABILITY.value: {
                "cyclomatic_complexity": 15,
                "code_coverage": 0.8,
                "documentation_coverage": 0.7,
                "modularity_score": 0.8
            },
            CriticAspect.SCALABILITY.value: {
                "load_testing_requirements": True,
                "concurrent_users_threshold": 1000,
                "response_time_threshold": 500,
                "resource_scaling": True
            },
            CriticAspect.RELIABILITY.value: {
                "error_handling": True,
                "retry_mechanisms": True,
                "backup_systems": True,
                "monitoring": True
            },
            CriticAspect.TESTABILITY.value: {
                "unit_test_coverage": 0.8,
                "integration_test_coverage": 0.6,
                "test_documentation": True,
                "mocking_support": True
            }
        }
        
    async def _execute_core_logic(self, message: Dict[str, Any]) -> Dict[str, Any]:
        """Implement quality assurance logic"""
        try:
            message_type = message.get("type", "")
            content = message.get("content", {})
            
            # Handle different types of review requests
            handlers = {
                "review": self._conduct_review,
                "validate": self._validate_implementation,
                "analyze": self._analyze_quality,
                "audit": self._conduct_audit,
                "suggest": self._generate_suggestions
            }
            
            handler = handlers.get(message_type, self._handle_unknown_request)
            result = await handler(content)
            
            # Update review history
            self._update_review_history(message_type, content, result)
            
            return result
            
        except Exception as e:
            self.logger.error(f"Review error: {str(e)}")
            return {
                "status": "error",
                "error": str(e),
                "timestamp": datetime.now().isoformat()
            }
            
    async def _conduct_review(self, content: Dict[str, Any]) -> Dict[str, Any]:
        """Conduct comprehensive review"""
        implementation = content.get("implementation", {})
        criteria = content.get("criteria", {})
        
        # Initialize review result
        review_result = {
            "status": "completed",
            "timestamp": datetime.now().isoformat(),
            "issues": [],
            "metrics": {},
            "suggestions": [],
            "requires_refinement": False
        }
        
        # Analyze each aspect
        for aspect in CriticAspect:
            aspect_result = await self._analyze_aspect(
                implementation,
                aspect,
                criteria.get(aspect.value, {})
            )
            
            review_result["issues"].extend(aspect_result["issues"])
            review_result["metrics"][aspect.value] = aspect_result["metrics"]
            review_result["suggestions"].extend(aspect_result["suggestions"])
            
        # Determine if refinement is needed
        critical_issues = [
            issue for issue in review_result["issues"]
            if issue["severity"] == CriticSeverity.CRITICAL.value
        ]
        error_issues = [
            issue for issue in review_result["issues"]
            if issue["severity"] == CriticSeverity.ERROR.value
        ]
        
        review_result["requires_refinement"] = (
            len(critical_issues) > 0 or len(error_issues) > 2
        )
        
        # Update quality metrics
        self._update_quality_metrics(review_result)
        
        return review_result
        
    async def _analyze_aspect(
        self,
        implementation: Dict[str, Any],
        aspect: CriticAspect,
        criteria: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Analyze a specific aspect of the implementation"""
        analysis_functions = {
            CriticAspect.CODE_QUALITY: self._analyze_code_quality,
            CriticAspect.SECURITY: self._analyze_security,
            CriticAspect.PERFORMANCE: self._analyze_performance,
            CriticAspect.MAINTAINABILITY: self._analyze_maintainability,
            CriticAspect.SCALABILITY: self._analyze_scalability,
            CriticAspect.RELIABILITY: self._analyze_reliability,
            CriticAspect.TESTABILITY: self._analyze_testability
        }
        
        analyzer = analysis_functions.get(aspect)
        if not analyzer:
            raise ValueError(f"No analyzer found for aspect: {aspect}")
            
        return await analyzer(implementation, criteria)
        
    async def _analyze_code_quality(
        self,
        implementation: Dict[str, Any],
        criteria: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Analyze code quality aspects"""
        issues = []
        metrics = {
            "complexity_score": 0.0,
            "duplication_score": 0.0,
            "naming_score": 0.0,
            "documentation_score": 0.0
        }
        suggestions = []
        
        # Analyze complexity
        complexity_result = self._analyze_complexity(implementation)
        if complexity_result["score"] > criteria.get("complexity_threshold", 10):
            issues.append(CriticIssue(
                id=self._generate_issue_id(),
                aspect=CriticAspect.CODE_QUALITY,
                severity=CriticSeverity.WARNING,
                title="High Complexity",
                description=f"Code complexity exceeds threshold: {complexity_result['score']}",
                location=complexity_result.get("location"),
                suggestion="Consider breaking down complex functions and reducing nesting",
                created_at=datetime.now(),
                metadata=complexity_result
            ))
            
        metrics["complexity_score"] = complexity_result["score"]
        
        # Analyze code duplication
        duplication_result = self._analyze_duplication(implementation)
        if duplication_result["percentage"] > criteria.get("duplication_threshold", 0.15):
            issues.append(CriticIssue(
                id=self._generate_issue_id(),
                aspect=CriticAspect.CODE_QUALITY,
                severity=CriticSeverity.WARNING,
                title="Code Duplication",
                description=f"Significant code duplication detected: {duplication_result['percentage']*100}%",
                location=duplication_result.get("locations"),
                suggestion="Extract duplicate code into reusable functions or classes",
                created_at=datetime.now(),
                metadata=duplication_result
            ))
            
        metrics["duplication_score"] = duplication_result["percentage"]
        
        # Add suggestions based on analysis
        if issues:
            suggestions.extend([
                {
                    "title": "Improve Code Quality",
                    "description": "Consider implementing the following improvements:",
                    "steps": [issue.suggestion for issue in issues]
                }
            ])
            
        return {
            "issues": [vars(issue) for issue in issues],
            "metrics": metrics,
            "suggestions": suggestions
        }
        
    async def _analyze_security(
        self,
        implementation: Dict[str, Any],
        criteria: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Analyze security aspects"""
        issues = []
        metrics = {
            "vulnerability_score": 0.0,
            "input_validation_score": 0.0,
            "auth_score": 0.0,
            "data_protection_score": 0.0
        }
        suggestions = []
        
        # Security checks implementation...
        # (Detailed security analysis would go here)
        
        return {
            "issues": [vars(issue) for issue in issues],
            "metrics": metrics,
            "suggestions": suggestions
        }
        
    async def _analyze_performance(
        self,
        implementation: Dict[str, Any],
        criteria: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Analyze performance aspects"""
        # Performance analysis implementation...
        return {
            "issues": [],
            "metrics": {},
            "suggestions": []
        }
        
    async def _analyze_maintainability(
        self,
        implementation: Dict[str, Any],
        criteria: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Analyze maintainability aspects"""
        # Maintainability analysis implementation...
        return {
            "issues": [],
            "metrics": {},
            "suggestions": []
        }
        
    async def _analyze_scalability(
        self,
        implementation: Dict[str, Any],
        criteria: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Analyze scalability aspects"""
        # Scalability analysis implementation...
        return {
            "issues": [],
            "metrics": {},
            "suggestions": []
        }
        
    async def _analyze_reliability(
        self,
        implementation: Dict[str, Any],
        criteria: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Analyze reliability aspects"""
        # Reliability analysis implementation...
        return {
            "issues": [],
            "metrics": {},
            "suggestions": []
        }
        
    async def _analyze_testability(
        self,
        implementation: Dict[str, Any],
        criteria: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Analyze testability aspects"""
        # Testability analysis implementation...
        return {
            "issues": [],
            "metrics": {},
            "suggestions": []
        }
        
    def _analyze_complexity(self, implementation: Dict[str, Any]) -> Dict[str, Any]:
        """Analyze code complexity"""
        # Complexity analysis implementation...
        return {
            "score": 5.0,
            "details": {}
        }
        
    def _analyze_duplication(self, implementation: Dict[str, Any]) -> Dict[str, Any]:
        """Analyze code duplication"""
        # Duplication analysis implementation...
        return {
            "percentage": 0.1,
            "locations": []
        }
        
    def _update_quality_metrics(self, review_result: Dict[str, Any]) -> None:
        """Update quality metrics based on review result"""
        for aspect in CriticAspect:
            metrics = review_result["metrics"].get(aspect.value, {})
            if metrics:
                self.quality_metrics[aspect.value]["current_score"] = (
                    sum(metrics.values()) / len(metrics)
                    if isinstance(metrics, dict) else metrics
                )
                self.quality_metrics[aspect.value]["history"].append({
                    "timestamp": datetime.now().isoformat(),
                    "score": self.quality_metrics[aspect.value]["current_score"]
                })
                
    def _update_review_history(
        self,
        review_type: str,
        content: Dict[str, Any],
        result: Dict[str, Any]
    ) -> None:
        """Update review history"""
        self.review_history.append({
            "type": review_type,
            "content_summary": {
                k: v for k, v in content.items()
                if k not in ["implementation"]  # Exclude large content
            },
            "result_summary": {
                "status": result.get("status"),
                "issues_count": len(result.get("issues", [])),
                "requires_refinement": result.get("requires_refinement", False)
            },
            "timestamp": datetime.now().isoformat()
        })
        
    def _generate_issue_id(self) -> str:
        """Generate unique issue ID"""
        import uuid
        return f"issue_{uuid.uuid4().hex[:8]}"