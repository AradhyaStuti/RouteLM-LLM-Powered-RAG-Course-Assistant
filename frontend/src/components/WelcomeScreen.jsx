import { Brain, Workflow, Database, Network, Layers, Code2, BarChart3, Boxes } from 'lucide-react';
import RobotAvatar from './RobotAvatar';

const suggestions = [
  { icon: <Brain size={14} />, text: 'What is supervised learning?' },
  { icon: <Workflow size={14} />, text: 'Gradient descent ko simple words me samjhao' },
  { icon: <Database size={14} />, text: 'What is RAG and why use it?' },
  { icon: <Network size={14} />, text: 'Self-attention kaise kaam karta hai?' },
  { icon: <Layers size={14} />, text: 'What is LangGraph used for?' },
  { icon: <Code2 size={14} />, text: 'Pandas groupby ka use kaise karte hain?' },
  { icon: <BarChart3 size={14} />, text: 'Random forest vs XGBoost — when to use which?' },
  { icon: <Boxes size={14} />, text: 'What are scikit-learn pipelines?' },
];

export default function WelcomeScreen({ onSuggestionClick }) {
  return (
    <div className="welcome">
      <div className="welcome-bot">
        <RobotAvatar size={48} />
        <div>
          <h2>RouteLM</h2>
          <p>Ask in English, Hindi, or Hinglish. Type or tap the mic. I'll route your question to the right corpus.</p>
        </div>
      </div>

      <h3>Try one of these</h3>
      <div className="suggestions">
        {suggestions.map((s) => (
          <button
            key={s.text}
            className="suggestion"
            onClick={() => onSuggestionClick(s.text)}
          >
            {s.icon}
            {s.text}
          </button>
        ))}
      </div>
    </div>
  );
}
