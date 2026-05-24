import { Sparkles, Brain, Workflow, ArrowRight, LogOut } from 'lucide-react';
import RobotMascot from './RobotMascot';

const features = [
  { icon: <Brain size={18} />, title: 'RAG Pipeline', desc: 'Grounded answers with source citations' },
  { icon: <Workflow size={18} />, title: 'LangGraph Router', desc: 'Classify → retrieve / direct / refuse' },
  { icon: <Sparkles size={18} />, title: 'Multi-Corpus', desc: 'Three courses, per-corpus thresholds' },
];

const techStack = ['LangChain', 'LangGraph', 'FAISS', 'Groq', 'Ollama'];

export default function LandingScreen({ username, onStart, onLogout }) {
  return (
    <div className="landing-screen">
      <button className="landing-logout" onClick={onLogout} aria-label="Sign out">
        <LogOut size={14} /> Sign out
      </button>

      <div className="landing-content">
        <div className="landing-robot" onClick={onStart} role="button" tabIndex={0} onKeyDown={e => e.key === 'Enter' && onStart()}>
          <RobotMascot size={180} message="Click me to start chatting!" />
        </div>

        <h1 className="landing-title">RouteLM</h1>
        <p className="landing-subtitle">
          Hey <strong>{username}</strong> — ask about Andrew Ng's ML course, the modern LLM / RAG stack, or Python data science. I'll figure out which corpus to use.
        </p>

        <button className="landing-start-btn" onClick={onStart}>
          <span>Start Chatting</span>
          <ArrowRight size={18} />
        </button>

        <div className="landing-features">
          {features.map(f => (
            <div key={f.title} className="landing-feature">
              <div className="landing-feature-icon">{f.icon}</div>
              <div>
                <strong>{f.title}</strong>
                <span>{f.desc}</span>
              </div>
            </div>
          ))}
        </div>

        <div className="landing-tech">
          {techStack.map(t => <span key={t}>{t}</span>)}
        </div>
      </div>
    </div>
  );
}
