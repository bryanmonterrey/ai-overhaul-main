"""
Orchestrator for AutoGen system.
Manages multi-agent workflows and coordination.
"""
from typing import Dict, Any, List, Optional, Callable
import asyncio
from datetime import datetime
import logging
from .config import AutoGenConfig, AgentRole
from .agents.base_agent import BaseAgent
from .agents.planner_agent import PlannerAgent
from .agents.critic_agent import CriticAgent
from .agents.coder_agent import CoderAgent

class AgentOrchestrator:
    """Orchestrates multi-agent interactions and workflows"""
    
    def __init__(self, config: AutoGenConfig):
        self.config = config
        self.agents: Dict[str, BaseAgent] = {}
        self.workflows: Dict[str, Dict[str, Any]] = {}
        self.active_tasks: Dict[str, Dict[str, Any]] = {}
        
        # Set up logging
        self.logger = logging.getLogger("autogen.orchestrator")
        self.logger.setLevel(logging.INFO)
        
        # Initialize agents
        self._initialize_agents()
        
        # Initialize workflow monitoring
        self.workflow_monitor = self._setup_workflow_monitor()
        
    def _initialize_agents(self):
        """Initialize all required agents"""
        agent_classes = {
            AgentRole.PLANNER: PlannerAgent,
            AgentRole.CRITIC: CriticAgent,
            AgentRole.CODER: CoderAgent
        }
        
        for role, agent_class in agent_classes.items():
            config = self.config.get_agent_config(role)
            if config:
                self.agents[role.value] = agent_class(config)
                
    def _setup_workflow_monitor(self):
        """Set up workflow monitoring system"""
        return {
            "active_workflows": {},
            "completed_workflows": {},
            "metrics": {
                "total_workflows": 0,
                "successful_workflows": 0,
                "failed_workflows": 0,
                "average_completion_time": 0
            }
        }
        
    async def execute_workflow(self, workflow_spec: Dict[str, Any]) -> Dict[str, Any]:
        """Execute a multi-agent workflow"""
        try:
            # Validate workflow specification
            self._validate_workflow_spec(workflow_spec)
            
            # Generate workflow ID
            workflow_id = self._generate_workflow_id()
            
            # Initialize workflow tracking
            self.workflows[workflow_id] = {
                "spec": workflow_spec,
                "status": "initializing",
                "start_time": datetime.now(),
                "current_stage": None,
                "completed_stages": [],
                "results": {},
                "errors": []
            }
            
            # Execute workflow stages
            result = await self._execute_workflow_stages(workflow_id)
            
            # Update workflow status
            self._update_workflow_status(workflow_id, "completed", result)
            
            return {
                "workflow_id": workflow_id,
                "status": "completed",
                "result": result
            }
            
        except Exception as e:
            self.logger.error(f"Workflow execution error: {str(e)}")
            if workflow_id in self.workflows:
                self._update_workflow_status(workflow_id, "failed", {"error": str(e)})
            raise
            
    async def _execute_workflow_stages(self, workflow_id: str) -> Dict[str, Any]:
        """Execute workflow stages in sequence"""
        workflow = self.workflows[workflow_id]
        stages = workflow["spec"]["stages"]
        results = {}
        
        for stage in stages:
            try:
                # Update current stage
                workflow["current_stage"] = stage
                
                # Execute stage
                stage_result = await self._execute_stage(stage, results)
                
                # Store results
                results[stage["id"]] = stage_result
                
                # Update completed stages
                workflow["completed_stages"].append(stage["id"])
                
            except Exception as e:
                self.logger.error(f"Stage execution error: {str(e)}")
                workflow["errors"].append({
                    "stage": stage["id"],
                    "error": str(e),
                    "timestamp": datetime.now().isoformat()
                })
                raise
                
        return results
        
    async def _execute_stage(self, stage: Dict[str, Any], previous_results: Dict[str, Any]) -> Dict[str, Any]:
        """Execute a single workflow stage"""
        stage_type = stage["type"]
        stage_handlers = {
            "planning": self._handle_planning_stage,
            "implementation": self._handle_implementation_stage,
            "review": self._handle_review_stage,
            "refinement": self._handle_refinement_stage
        }
        
        if stage_type not in stage_handlers:
            raise ValueError(f"Unknown stage type: {stage_type}")
            
        handler = stage_handlers[stage_type]
        return await handler(stage, previous_results)
        
    async def _handle_planning_stage(self, stage: Dict[str, Any], previous_results: Dict[str, Any]) -> Dict[str, Any]:
        """Handle planning stage execution"""
        planner = self.agents.get(AgentRole.PLANNER.value)
        if not planner:
            raise ValueError("Planner agent not initialized")
            
        # Prepare planning request
        planning_request = {
            "type": "create_plan",
            "content": {
                "objectives": stage.get("objectives", []),
                "constraints": stage.get("constraints", []),
                "context": previous_results
            }
        }
        
        # Execute planning
        return await planner.process_message(planning_request)
        
    async def _handle_implementation_stage(self, stage: Dict[str, Any], previous_results: Dict[str, Any]) -> Dict[str, Any]:
        """Handle implementation stage execution"""
        coder = self.agents.get(AgentRole.CODER.value)
        if not coder:
            raise ValueError("Coder agent not initialized")
            
        # Get plan from previous results
        plan = previous_results.get(stage.get("plan_reference"))
        if not plan:
            raise ValueError("No plan found for implementation")
            
        # Prepare implementation request
        implementation_request = {
            "type": "implement",
            "content": {
                "plan": plan,
                "requirements": stage.get("requirements", {}),
                "context": previous_results
            }
        }
        
        # Execute implementation
        return await coder.process_message(implementation_request)
        
    async def _handle_review_stage(self, stage: Dict[str, Any], previous_results: Dict[str, Any]) -> Dict[str, Any]:
        """Handle review stage execution"""
        critic = self.agents.get(AgentRole.CRITIC.value)
        if not critic:
            raise ValueError("Critic agent not initialized")
            
        # Get implementation from previous results
        implementation = previous_results.get(stage.get("implementation_reference"))
        if not implementation:
            raise ValueError("No implementation found for review")
            
        # Prepare review request
        review_request = {
            "type": "review",
            "content": {
                "implementation": implementation,
                "criteria": stage.get("review_criteria", {}),
                "context": previous_results
            }
        }
        
        # Execute review
        return await critic.process_message(review_request)
        
    async def _handle_refinement_stage(self, stage: Dict[str, Any], previous_results: Dict[str, Any]) -> Dict[str, Any]:
        """Handle refinement stage execution"""
        # Get review results
        review_results = previous_results.get(stage.get("review_reference"))
        if not review_results:
            raise ValueError("No review results found for refinement")
            
        # Check if refinement is needed
        if not review_results.get("requires_refinement", False):
            return {"status": "skipped", "reason": "no refinement required"}
            
        # Get appropriate agent for refinement
        agent_role = self._determine_refinement_agent(review_results)
        agent = self.agents.get(agent_role.value)
        if not agent:
            raise ValueError(f"Agent not found for refinement: {agent_role}")
            
        # Prepare refinement request
        refinement_request = {
            "type": "refine",
            "content": {
                "review": review_results,
                "implementation": previous_results.get(stage.get("implementation_reference")),
                "context": previous_results
            }
        }
        
        # Execute refinement
        return await agent.process_message(refinement_request)
        
    def _determine_refinement_agent(self, review_results: Dict[str, Any]) -> AgentRole:
        """Determine which agent should handle refinement"""
        issues = review_results.get("issues", [])
        issue_types = {issue["type"] for issue in issues}
        
        if "architecture" in issue_types or "design" in issue_types:
            return AgentRole.PLANNER
        elif "implementation" in issue_types or "code" in issue_types:
            return AgentRole.CODER
        else:
            return AgentRole.CRITIC
            
    def _validate_workflow_spec(self, workflow_spec: Dict[str, Any]) -> None:
        """Validate workflow specification"""
        required_fields = {"stages", "success_criteria", "timeout_seconds"}
        if not all(field in workflow_spec for field in required_fields):
            raise ValueError(f"Missing required fields: {required_fields - workflow_spec.keys()}")
            
        # Validate stages
        if not workflow_spec["stages"]:
            raise ValueError("Workflow must have at least one stage")
            
        for stage in workflow_spec["stages"]:
            self._validate_stage_spec(stage)
            
    def _validate_stage_spec(self, stage: Dict[str, Any]) -> None:
        """Validate stage specification"""
        required_fields = {"id", "type"}
        if not all(field in stage for field in required_fields):
            raise ValueError(f"Missing required fields in stage: {required_fields - stage.keys()}")
            
    def _generate_workflow_id(self) -> str:
        """Generate unique workflow ID"""
        import uuid
        return f"workflow_{uuid.uuid4().hex[:8]}"
        
    def _update_workflow_status(self, workflow_id: str, status: str, result: Dict[str, Any]) -> None:
        """Update workflow status and metrics"""
        workflow = self.workflows[workflow_id]
        workflow["status"] = status
        workflow["end_time"] = datetime.now()
        workflow["results"] = result
        
        # Update metrics
        duration = (workflow["end_time"] - workflow["start_time"]).total_seconds()
        metrics = self.workflow_monitor["metrics"]
        
        metrics["total_workflows"] += 1
        if status == "completed":
            metrics["successful_workflows"] += 1
        elif status == "failed":
            metrics["failed_workflows"] += 1
            
        # Update average completion time
        total_completed = metrics["successful_workflows"]
        current_avg = metrics["average_completion_time"]
        metrics["average_completion_time"] = (
            (current_avg * (total_completed - 1) + duration) / total_completed
            if total_completed > 0 else duration
        )
        
    async def get_workflow_status(self, workflow_id: str) -> Dict[str, Any]:
        """Get current workflow status"""
        if workflow_id not in self.workflows:
            raise ValueError(f"Workflow not found: {workflow_id}")
            
        workflow = self.workflows[workflow_id]
        return {
            "id": workflow_id,
            "status": workflow["status"],
            "current_stage": workflow["current_stage"],
            "completed_stages": workflow["completed_stages"],
            "errors": workflow["errors"],
            "start_time": workflow["start_time"].isoformat(),
            "end_time": workflow.get("end_time", "").isoformat() if workflow.get("end_time") else None
        }
        
    def get_metrics(self) -> Dict[str, Any]:
        """Get orchestrator metrics"""
        return {
            "workflows": {
                "total": self.workflow_monitor["metrics"]["total_workflows"],
                "successful": self.workflow_monitor["metrics"]["successful_workflows"],
                "failed": self.workflow_monitor["metrics"]["failed_workflows"],
                "average_completion_time": self.workflow_monitor["metrics"]["average_completion_time"]
            },
            "agents": {
                role: agent.get_metrics()
                for role, agent in self.agents.items()
            }
        }