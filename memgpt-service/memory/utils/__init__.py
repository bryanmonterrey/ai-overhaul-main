import logging
from .embedding import EmbeddingManager
from typing import List, Dict, Any, Optional
import numpy as np
from datetime import datetime, timedelta, timezone
import re
import json
from collections import defaultdict, Counter

__all__ = [
    'EmbeddingManager'
]

def batch_process_texts(texts: List[str], batch_size: int = 8):
    """Process texts in batches"""
    for i in range(0, len(texts), batch_size):
        yield texts[i:i + batch_size]

def calculate_text_complexity(text: str) -> float:
    """Calculate text complexity score"""
    if not text or not isinstance(text, str):
        return 0.0
        
    try:
        # Calculate complexity based on:
        # 1. Word length
        # 2. Sentence length
        # 3. Unique words ratio
        
        words = text.split()
        if not words:
            return 0.0
            
        # Average word length
        avg_word_length = sum(len(word) for word in words) / len(words)
        
        # Unique words ratio
        unique_ratio = len(set(words)) / len(words)
        
        # Average sentence length
        sentences = [s.strip() for s in text.split('.') if s.strip()]
        avg_sentence_length = len(words) / (len(sentences) if sentences else 1)
        
        # Combine metrics
        complexity = (
            0.3 * min(avg_word_length / 10, 1.0) +  # Cap at 1.0
            0.4 * unique_ratio +
            0.3 * min(avg_sentence_length / 20, 1.0)  # Cap at 1.0
        )
        
        return float(complexity)
        
    except Exception as e:
        logging.error(f"Error calculating text complexity: {str(e)}")
        return 0.0  # Return safe default

def extract_temporal_references(text: str) -> List[str]:
    """Extract time-related references"""
    # Implementation

def detect_semantic_drift(embeddings: List[np.ndarray]) -> float:
    """Calculate semantic drift in a sequence"""
    # Implementation

def analyze_memory_patterns(memory_sequence: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Analyze patterns in memory sequence"""
    patterns = {
        'temporal': _analyze_temporal_patterns(memory_sequence),
        'emotional': _analyze_emotional_patterns(memory_sequence),
        'topic': _analyze_topic_patterns(memory_sequence),
        'interaction': _analyze_interaction_patterns(memory_sequence)
    }
    return patterns

def _analyze_temporal_patterns(memories: List[Dict]) -> Dict[str, Any]:
    """Analyze temporal patterns in memories"""
    timestamps = [
        datetime.fromisoformat(m['created_at']) 
        for m in memories if 'created_at' in m
    ]
    
    if not timestamps:
        return {'pattern': 'no_temporal_data'}
        
    # Calculate time differences
    time_diffs = [
        (timestamps[i] - timestamps[i-1]).total_seconds()
        for i in range(1, len(timestamps))
    ]
    
    # Analyze patterns
    avg_diff = sum(time_diffs) / len(time_diffs) if time_diffs else 0
    std_diff = np.std(time_diffs) if time_diffs else 0
    
    return {
        'average_interval': avg_diff,
        'interval_std': std_diff,
        'pattern': _classify_temporal_pattern(avg_diff, std_diff)
    }

def _analyze_emotional_patterns(memories: List[Dict]) -> Dict[str, Any]:
    """Analyze emotional patterns in memories"""
    emotions = [
        m.get('emotional_context', 'neutral') 
        for m in memories
    ]
    
    # Count transitions
    transitions = defaultdict(int)
    for i in range(1, len(emotions)):
        transition = f"{emotions[i-1]}_to_{emotions[i]}"
        transitions[transition] += 1
        
    # Find dominant patterns
    if transitions:
        dominant = max(transitions.items(), key=lambda x: x[1])
        return {
            'dominant_transition': dominant[0],
            'transition_count': dict(transitions),
            'pattern': _classify_emotional_pattern(emotions)
        }
    return {'pattern': 'no_emotional_data'}

def _analyze_topic_patterns(memories: List[Dict]) -> Dict[str, Any]:
    """Analyze topic patterns in memories"""
    # Extract topics from content
    topics = []
    for memory in memories:
        content = memory.get('content', '')
        if content:
            # Simple topic extraction (can be enhanced)
            words = content.lower().split()
            topics.extend([w for w in words if len(w) > 4])
            
    if not topics:
        return {'pattern': 'no_topic_data'}
        
    # Count topic frequencies
    topic_counts = Counter(topics)
    
    return {
        'dominant_topics': dict(topic_counts.most_common(5)),
        'topic_diversity': len(topic_counts) / len(topics),
        'pattern': _classify_topic_pattern(topic_counts)
    }

def _analyze_interaction_patterns(memories: List[Dict]) -> Dict[str, Any]:
    """Analyze interaction patterns in memories"""
    interactions = defaultdict(int)
    platforms = defaultdict(int)
    
    for memory in memories:
        # Count interaction types
        metadata = memory.get('metadata', {})
        interaction_type = metadata.get('interaction_type')
        if interaction_type:
            interactions[interaction_type] += 1
            
        # Count platforms
        platform = memory.get('platform')
        if platform:
            platforms[platform] += 1
            
    return {
        'interaction_distribution': dict(interactions),
        'platform_distribution': dict(platforms),
        'dominant_platform': max(platforms.items(), key=lambda x: x[1])[0] if platforms else None,
        'pattern': _classify_interaction_pattern(interactions)
    }

def _classify_temporal_pattern(avg_interval: float, std_interval: float) -> str:
    """Classify temporal pattern based on intervals"""
    if std_interval < avg_interval * 0.2:
        return 'regular'
    elif std_interval < avg_interval * 0.5:
        return 'semi_regular'
    return 'irregular'

def _classify_emotional_pattern(emotions: List[str]) -> str:
    """Classify emotional pattern sequence"""
    if not emotions:
        return 'unknown'
        
    # Count consecutive emotions
    runs = []
    current_run = 1
    for i in range(1, len(emotions)):
        if emotions[i] == emotions[i-1]:
            current_run += 1
        else:
            runs.append(current_run)
            current_run = 1
    runs.append(current_run)
    
    # Analyze pattern
    avg_run = sum(runs) / len(runs) if runs else 0
    if avg_run > 3:
        return 'stable'
    elif len(set(emotions)) < len(emotions) * 0.3:
        return 'cyclic'
    return 'volatile'

def _classify_topic_pattern(topic_counts: Counter) -> str:
    """Classify topic distribution pattern"""
    if not topic_counts:
        return 'unknown'
        
    # Calculate topic concentration
    total = sum(topic_counts.values())
    top_concentration = sum(
        count / total 
        for count in sorted(topic_counts.values(), reverse=True)[:3]
    )
    
    if top_concentration > 0.7:
        return 'focused'
    elif top_concentration > 0.4:
        return 'semi_focused'
    return 'diverse'

def _classify_interaction_pattern(interactions: Dict[str, int]) -> str:
    """Classify interaction behavior pattern"""
    if not interactions:
        return 'unknown'
        
    total = sum(interactions.values())
    distribution = {k: v/total for k, v in interactions.items()}
    
    # Check for dominant patterns
    max_interaction = max(distribution.values())
    if max_interaction > 0.7:
        return 'specialized'
    elif max_interaction > 0.4:
        return 'preferred'
    return 'balanced'

def optimize_memory_storage(memories: List[Dict[str, Any]], max_size: int = 1000) -> List[Dict[str, Any]]:
    """Optimize memory storage while preserving important information"""
    if len(memories) <= max_size:
        return memories
        
    # Score memories for retention
    scored_memories = [
        (memory, _calculate_retention_score(memory))
        for memory in memories
    ]
    
    # Sort by score and retain most important
    sorted_memories = sorted(
        scored_memories,
        key=lambda x: x[1],
        reverse=True
    )
    
    return [memory for memory, _ in sorted_memories[:max_size]]

def _calculate_retention_score(memory: Dict[str, Any]) -> float:
    """Calculate memory retention score based on multiple factors"""
    score = 0.0
    
    # Base importance
    score += memory.get('importance', 0) * 0.3
    
    # Recency factor
    if 'created_at' in memory:
        age = (datetime.now() - datetime.fromisoformat(memory['created_at'])).days
        recency_score = 1.0 / (1.0 + age/30)  # 30-day half-life
        score += recency_score * 0.2
        
    # Connection importance
    metadata = memory.get('metadata', {})
    connection_count = len(metadata.get('connections', []))
    connection_score = min(connection_count / 10, 1.0)
    score += connection_score * 0.2
    
    # Emotional significance
    if memory.get('emotional_context') not in ['neutral', None]:
        score += 0.15
        
    # Interaction importance
    if metadata.get('interaction_count', 0) > 0:
        interaction_score = min(metadata['interaction_count'] / 5, 1.0)
        score += interaction_score * 0.15
        
    return score

def compress_memory_content(content: str, max_length: int = 1000) -> str:
    """Compress memory content while preserving key information"""
    if len(content) <= max_length:
        return content
        
    # Extract key sentences
    sentences = [s.strip() for s in content.split('.') if s.strip()]
    if not sentences:
        return content[:max_length]
        
    # Score sentences for retention
    scored_sentences = [
        (sentence, _calculate_sentence_importance(sentence, sentences))
        for sentence in sentences
    ]
    
    # Sort by importance
    sorted_sentences = sorted(
        scored_sentences,
        key=lambda x: x[1],
        reverse=True
    )
    
    # Build compressed content
    compressed = []
    current_length = 0
    
    for sentence, _ in sorted_sentences:
        if current_length + len(sentence) + 2 > max_length:
            break
        compressed.append(sentence)
        current_length += len(sentence) + 2
        
    return '. '.join(compressed) + ('...' if compressed else '')

def _calculate_sentence_importance(sentence: str, all_sentences: List[str]) -> float:
    """Calculate sentence importance score"""
    words = set(sentence.lower().split())
    
    # Calculate term frequency across all sentences
    term_freq = defaultdict(int)
    for s in all_sentences:
        for word in s.lower().split():
            term_freq[word] += 1
            
    # Calculate sentence score based on term importance
    score = sum(
        1.0 / term_freq[word]
        for word in words
        if word in term_freq
    ) / len(words) if words else 0
    
    # Bonus for sentences with numbers or key phrases
    if any(c.isdigit() for c in sentence):
        score *= 1.2
    
    if re.search(r'\b(important|key|significant|critical|essential)\b', sentence.lower()):
        score *= 1.1
        
    return score

def calculate_memory_statistics(memories: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Calculate comprehensive memory statistics"""
    if not memories:
        return {"error": "No memories provided"}
        
    stats = {
        "total_count": len(memories),
        "temporal": {
            "oldest": min(m['created_at'] for m in memories if 'created_at' in m),
            "newest": max(m['created_at'] for m in memories if 'created_at' in m),
            "avg_age_days": _calculate_average_age(memories)
        },
        "importance": {
            "avg": np.mean([m.get('importance', 0) for m in memories]),
            "std": np.std([m.get('importance', 0) for m in memories]),
            "high_importance_count": sum(1 for m in memories if m.get('importance', 0) > 0.7)
        },
        "content": {
            "avg_length": np.mean([len(m.get('content', '')) for m in memories]),
            "total_size_bytes": sum(len(json.dumps(m)) for m in memories)
        },
        "emotional": _calculate_emotional_stats(memories),
        "connections": _calculate_connection_stats(memories)
    }
    
    return stats

def _calculate_average_age(memories: List[Dict[str, Any]]) -> float:
    """Calculate average age of memories in days"""
    now = datetime.now(timezone.utc)  # Make timezone-aware
    ages = []
    
    for memory in memories:
        if 'created_at' in memory:
            try:
                # Parse the date and ensure it's timezone-aware
                created_date = datetime.fromisoformat(memory['created_at'])
                if created_date.tzinfo is None:
                    created_date = created_date.replace(tzinfo=timezone.utc)
                ages.append((now - created_date).days)
            except Exception as e:
                continue
                
    return sum(ages) / len(ages) if ages else 0

def _calculate_emotional_stats(memories: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Calculate emotional statistics"""
    emotions = [m.get('emotional_context') for m in memories]
    emotion_counts = Counter(e for e in emotions if e)
    
    return {
        "distribution": dict(emotion_counts),
        "dominant_emotion": max(emotion_counts.items(), key=lambda x: x[1])[0] if emotion_counts else None,
        "emotional_diversity": len(emotion_counts) / len(memories) if memories else 0
    }

def _calculate_connection_stats(memories: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Calculate connection statistics"""
    connection_counts = [
        len(m.get('metadata', {}).get('connections', []))
        for m in memories
    ]
    
    return {
        "avg_connections": np.mean(connection_counts) if connection_counts else 0,
        "max_connections": max(connection_counts) if connection_counts else 0,
        "isolated_count": sum(1 for c in connection_counts if c == 0)
    }