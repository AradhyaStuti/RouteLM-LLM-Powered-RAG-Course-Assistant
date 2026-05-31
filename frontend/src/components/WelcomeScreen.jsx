import { Brain, Workflow, Database, Network, Layers, Code2, BarChart3, Boxes } from 'lucide-react';
import RobotAvatar from './RobotAvatar';

const suggestions = [
  { icon: <Brain size={14} />, text: 'What is supervised learning?' },
  { icon: <Workflow size={14} />, text: 'Gradient descent ko simple words me samjhao' },
  { icon: <Database size={14} />, text: 'Explain ACID properties in DBMS' },
  { icon: <Network size={14} />, text: 'TCP vs UDP — kab kaunsa use karein?' },
  { icon: <Layers size={14} />, text: 'How does CPU scheduling work?' },
  { icon: <Code2 size={14} />, text: 'Dynamic programming kya hota hai?' },
  { icon: <BarChart3 size={14} />, text: 'What is the CIA triad in cyber security?' },
  { icon: <Boxes size={14} />, text: 'IaaS vs PaaS vs SaaS — difference?' },
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
