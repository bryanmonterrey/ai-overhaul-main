"""
Planner Agent implementation for AutoGen system.
Specializes in strategic planning and task decomposition.
"""
from typing import Dict, Any, List, Optional
from datetime import datetime
import asyncio
from .base_agent import BaseAgent
from ..config import AgentConfig, AgentRole
from dataclasses import dataclass
from enum import Enum

class TaskPriority(Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"

class TaskStatus(Enum):
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    BLOCKED = "blocked"
    COMPLETED = "completed"
    FAILED = "failed"

@dataclass
class Task:
    """Representation of a planned task"""
    id: str
    title: str
    description: str
    priority: TaskPriority
    dependencies: List[str]
    estimated_duration: int  # in minutes
    assigned_to: Optional[str]
    status: TaskStatus
    created_at: datetime
    updated_at: datetime
    metadata: Dict[str, Any]

class PlannerAgent(BaseAgent):
    """Strategic planning agent with sophisticated planning capabilities"""
    
    def __init__(self, config: AgentConfig):
        super().__init__(config)
        self.active_plans: Dict[str, List[Task]] = {}
        self.task_history: List[Task] = []
        self.planning_strategies = self._initialize_strategies()
        
    def _initialize_strategies(self) -> Dict[str, Any]:
        """Initialize planning strategies"""
        return {
            "task_decomposition": {
                "min_task_size": 30,  # minutes
                "max_subtasks": 5,
                "complexity_threshold": 0.7
            },
            "resource_allocation": {
                "max_parallel_tasks": 3,
                "buffer_factor": 1.2
            },
            "risk_management": {
                "risk_threshold": 0.6,
                "contingency_time": 0.2  # 20% buffer
            }
        }
        
    async def _execute_core_logic(self, message: Dict[str, Any]) -> Dict[str, Any]:
        """Implement strategic planning logic"""
        try:
            message_type = message.get("type", "")
            content = message.get("content", {})
            
            # Handle different types of planning requests
            handlers = {
                "create_plan": self._create_strategic_plan,
                "update_plan": self._update_existing_plan,
                "evaluate_progress": self._evaluate_plan_progress,
                "handle_blockers": self._resolve_blockers,
                "optimize_plan": self._optimize_current_plan
            }
            
            handler = handlers.get(message_type, self._handle_unknown_request)
            result = await handler(content)
            
            return {
                "status": "success",
                "content": result,
                "timestamp": datetime.now().isoformat()
            }
            
        except Exception as e:
            self.logger.error(f"Planning error: {str(e)}")
            return {
                "status": "error",
                "error": str(e),
                "timestamp": datetime.now().isoformat()
            }
            
    async def _create_strategic_plan(self, requirements: Dict[str, Any]) -> Dict[str, Any]:
        """Create a comprehensive strategic plan"""
        try:
            # Validate requirements
            self._validate_planning_requirements(requirements)
            
            # Decompose into tasks
            tasks = await self._decompose_into_tasks(requirements)
            
            # Analyze dependencies
            tasks_with_dependencies = self._analyze_dependencies(tasks)
            
            # Assign priorities
            prioritized_tasks = self._assign_priorities(tasks_with_dependencies)
            
            # Create execution timeline
            timeline = self._create_timeline(prioritized_tasks)
            
            # Risk analysis
            risks = self._analyze_risks(timeline)
            
            # Generate plan ID
            plan_id = self._generate_plan_id()
            
            # Store plan
            self.active_plans[plan_id] = {
                "tasks": prioritized_tasks,
                "timeline": timeline,
                "risks": risks,
                "metadata": {
                    "created_at": datetime.now().isoformat(),
                    "requirements": requirements,
                    "status": "active"
                }
            }
            
            return {
                "plan_id": plan_id,
                "tasks": prioritized_tasks,
                "timeline": timeline,
                "risks": risks
            }
            
        except Exception as e:
            self.logger.error(f"Error creating plan: {str(e)}")
            raise
            
    async def _decompose_into_tasks(self, requirements: Dict[str, Any]) -> List[Task]:
        """Decompose requirements into concrete tasks"""
        tasks = []
        strategy = self.planning_strategies["task_decomposition"]
        
        for requirement in requirements.get("objectives", []):
            # Analyze complexity
            complexity = self._analyze_complexity(requirement)
            
            if complexity > strategy["complexity_threshold"]:
                # Break down complex requirements
                subtasks = self._break_down_requirement(requirement)
                tasks.extend(subtasks)
            else:
                # Create single task for simple requirements
                task = self._create_task(requirement)
                tasks.append(task)
                
        return tasks
        
    def _analyze_dependencies(self, tasks: List[Task]) -> List[Task]:
        """Analyze and establish task dependencies"""
        dependency_graph = {}
        
        # Build dependency graph
        for task in tasks:
            dependencies = self._identify_dependencies(task)
            dependency_graph[task.id] = dependencies
            
        # Validate dependencies (check for cycles)
        self._validate_dependencies(dependency_graph)
        
        # Update tasks with dependencies
        return self._update_task_dependencies(tasks, dependency_graph)
        
    def _assign_priorities(self, tasks: List[Task]) -> List[Task]:
        """Assign priorities to tasks based on multiple factors"""
        for task in tasks:
            # Calculate priority score
            dependency_score = self._calculate_dependency_score(task)
            impact_score = self._calculate_impact_score(task)
            urgency_score = self._calculate_urgency_score(task)
            
            # Combine scores
            total_score = (
                dependency_score * 0.4 +
                impact_score * 0.3 +
                urgency_score * 0.3
            )
            
            # Assign priority based on score
            task.priority = self._score_to_priority(total_score)
            
        return sorted(tasks, key=lambda x: self._priority_to_value(x.priority), reverse=True)
        
    def _create_timeline(self, tasks: List[Task]) -> Dict[str, Any]:
        """Create execution timeline with sophisticated scheduling"""
        timeline = {
            "phases": [],
            "critical_path": [],
            "milestones": [],
            "estimated_completion": None
        }
        
        # Group tasks into phases
        phases = self._group_tasks_into_phases(tasks)
        
        # Calculate critical path
        critical_path = self._calculate_critical_path(tasks)
        
        # Identify milestones
        milestones = self._identify_milestones(tasks)
        
        # Estimate completion time
        completion_time = self._estimate_completion_time(tasks, critical_path)
        
        timeline.update({
            "phases": phases,
            "critical_path": critical_path,
            "milestones": milestones,
            "estimated_completion": completion_time.isoformat()
        })
        
        return timeline
        
    def _analyze_risks(self, timeline: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Analyze potential risks and create mitigation strategies"""
        risks = []
        
        # Analyze timeline risks
        timeline_risks = self._analyze_timeline_risks(timeline)
        risks.extend(timeline_risks)
        
        # Analyze resource risks
        resource_risks = self._analyze_resource_risks(timeline)
        risks.extend(resource_risks)
        
        # Analyze dependency risks
        dependency_risks = self._analyze_dependency_risks(timeline)
        risks.extend(dependency_risks)
        
        # Prioritize risks
        prioritized_risks = self._prioritize_risks(risks)
        
        return prioritized_risks
        
    async def _update_existing_plan(self, update_data: Dict[str, Any]) -> Dict[str, Any]:
        """Update an existing plan with new information"""
        plan_id = update_data.get("plan_id")
        if plan_id not in self.active_plans:
            raise ValueError(f"Plan {plan_id} not found")
            
        plan = self.active_plans[plan_id]
        
        # Apply updates
        updated_plan = await self._apply_plan_updates(plan, update_data)
        
        # Revalidate plan
        self._validate_plan(updated_plan)
        
        # Update storage
        self.active_plans[plan_id] = updated_plan
        
        return updated_plan
        
    async def _evaluate_plan_progress(self, plan_id: str) -> Dict[str, Any]:
        """Evaluate current plan progress and generate insights"""
        if plan_id not in self.active_plans:
            raise ValueError(f"Plan {plan_id} not found")
            
        plan = self.active_plans[plan_id]
        
        # Calculate progress metrics
        progress_metrics = self._calculate_progress_metrics(plan)
        
        # Identify bottlenecks
        bottlenecks = self._identify_bottlenecks(plan)
        
        # Generate recommendations
        recommendations = self._generate_recommendations(plan, progress_metrics, bottlenecks)
        
        return {
            "progress_metrics": progress_metrics,
            "bottlenecks": bottlenecks,
            "recommendations": recommendations
        }
    
    def _validate_planning_requirements(self, requirements: Dict[str, Any]) -> None:
        """Validate planning requirements for completeness"""
        required_fields = {
            "objectives": list,
            "constraints": list,
            "timeline": dict,
            "resources": dict
        }
        
        for field, expected_type in required_fields.items():
            if field not in requirements:
                raise ValueError(f"Missing required field: {field}")
            if not isinstance(requirements[field], expected_type):
                raise TypeError(f"Invalid type for {field}")

    def _analyze_complexity(self, requirement: Dict[str, Any]) -> float:
        """Analyze requirement complexity"""
        complexity_factors = {
            "dependencies": 0.3,
            "resource_needs": 0.2,
            "technical_difficulty": 0.3,
            "uncertainty": 0.2
        }
        
        total_complexity = 0.0
        for factor, weight in complexity_factors.items():
            score = self._calculate_factor_complexity(requirement, factor)
            total_complexity += score * weight
            
        return total_complexity

    def _calculate_factor_complexity(self, requirement: Dict[str, Any], factor: str) -> float:
        """Calculate complexity score for a specific factor"""
        if factor == "dependencies":
            return len(requirement.get("dependencies", [])) * 0.1
        elif factor == "resource_needs":
            return len(requirement.get("required_resources", [])) * 0.15
        elif factor == "technical_difficulty":
            return requirement.get("difficulty_rating", 0.5)
        elif factor == "uncertainty":
            return requirement.get("uncertainty_level", 0.3)
        return 0.0

    def _break_down_requirement(self, requirement: Dict[str, Any]) -> List[Task]:
        """Break down complex requirements into smaller tasks"""
        subtasks = []
        
        # Identify components
        components = self._identify_components(requirement)
        
        # Create tasks for each component
        for component in components:
            task = self._create_task(component)
            subtasks.append(task)
            
        return subtasks

    def _identify_components(self, requirement: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Identify logical components of a requirement"""
        components = []
        
        # Extract main objective
        main_objective = requirement.get("objective", "")
        
        # Break down based on different aspects
        technical_components = self._break_down_technical_aspects(requirement)
        functional_components = self._break_down_functional_aspects(requirement)
        implementation_components = self._break_down_implementation_aspects(requirement)
        
        components.extend(technical_components)
        components.extend(functional_components)
        components.extend(implementation_components)
        
        return components

    def _create_task(self, component: Dict[str, Any]) -> Task:
        """Create a task from a component"""
        return Task(
            id=self._generate_task_id(),
            title=component.get("title", "Untitled Task"),
            description=component.get("description", ""),
            priority=TaskPriority.MEDIUM,
            dependencies=[],
            estimated_duration=self._estimate_task_duration(component),
            assigned_to=None,
            status=TaskStatus.PENDING,
            created_at=datetime.now(),
            updated_at=datetime.now(),
            metadata=component.get("metadata", {})
        )

    def _estimate_task_duration(self, component: Dict[str, Any]) -> int:
        """Estimate task duration in minutes"""
        base_duration = component.get("base_duration", 60)
        complexity_factor = self._analyze_complexity(component)
        uncertainty_factor = component.get("uncertainty_factor", 1.2)
        
        return int(base_duration * complexity_factor * uncertainty_factor)

    def _identify_dependencies(self, task: Task) -> List[str]:
        """Identify dependencies for a task"""
        dependencies = set()
        
        # Technical dependencies
        tech_deps = self._identify_technical_dependencies(task)
        dependencies.update(tech_deps)
        
        # Resource dependencies
        resource_deps = self._identify_resource_dependencies(task)
        dependencies.update(resource_deps)
        
        # Logical dependencies
        logical_deps = self._identify_logical_dependencies(task)
        dependencies.update(logical_deps)
        
        return list(dependencies)

    def _validate_dependencies(self, dependency_graph: Dict[str, List[str]]) -> None:
        """Validate dependency graph for cycles"""
        visited = set()
        temp_visited = set()
        
        def visit(task_id: str):
            if task_id in temp_visited:
                raise ValueError(f"Cyclic dependency detected involving task {task_id}")
            if task_id in visited:
                return
                
            temp_visited.add(task_id)
            
            for dep in dependency_graph.get(task_id, []):
                visit(dep)
                
            temp_visited.remove(task_id)
            visited.add(task_id)
            
        for task_id in dependency_graph:
            if task_id not in visited:
                visit(task_id)

    def _update_task_dependencies(self, tasks: List[Task], dependency_graph: Dict[str, List[str]]) -> List[Task]:
        """Update tasks with validated dependencies"""
        task_map = {task.id: task for task in tasks}
        
        for task_id, dependencies in dependency_graph.items():
            if task_id in task_map:
                task_map[task_id].dependencies = dependencies
                
        return list(task_map.values())

    def _calculate_dependency_score(self, task: Task) -> float:
        """Calculate dependency-based priority score"""
        # More dependencies = higher priority
        dependency_count = len(task.dependencies)
        return min(dependency_count * 0.2, 1.0)

    def _calculate_impact_score(self, task: Task) -> float:
        """Calculate impact-based priority score"""
        impact_factors = task.metadata.get("impact_factors", {})
        
        # Calculate weighted impact
        weighted_impact = sum(
            score * weight
            for factor, (score, weight) in impact_factors.items()
        )
        
        return min(weighted_impact, 1.0)

    def _calculate_urgency_score(self, task: Task) -> float:
        """Calculate urgency-based priority score"""
        if not task.estimated_duration:
            return 0.5
            
        # Consider deadline proximity and dependencies
        deadline = task.metadata.get("deadline")
        if deadline:
            time_until_deadline = (datetime.fromisoformat(deadline) - datetime.now()).total_seconds()
            urgency = 1.0 - (time_until_deadline / (task.estimated_duration * 60))
            return max(min(urgency, 1.0), 0.0)
            
        return 0.5

    def _score_to_priority(self, score: float) -> TaskPriority:
        """Convert numerical score to TaskPriority"""
        if score >= 0.8:
            return TaskPriority.CRITICAL
        elif score >= 0.6:
            return TaskPriority.HIGH
        elif score >= 0.4:
            return TaskPriority.MEDIUM
        return TaskPriority.LOW

    def _priority_to_value(self, priority: TaskPriority) -> int:
        """Convert TaskPriority to numerical value for sorting"""
        priority_values = {
            TaskPriority.CRITICAL: 4,
            TaskPriority.HIGH: 3,
            TaskPriority.MEDIUM: 2,
            TaskPriority.LOW: 1
        }
        return priority_values.get(priority, 0)

    def _generate_task_id(self) -> str:
        """Generate unique task ID"""
        import uuid
        return f"task_{uuid.uuid4().hex[:8]}"

    def _generate_plan_id(self) -> str:
        """Generate unique plan ID"""
        import uuid
        return f"plan_{uuid.uuid4().hex[:8]}"