import { useRef } from 'react';
import {
  Sparkles, Brain, Workflow, ArrowRight, LogOut,
  Database, Network, Layers, Code2, BarChart3, Boxes,
  Cpu, Shield, Cloud, Globe, Terminal, GitBranch,
  ChevronLeft, ChevronRight,
} from 'lucide-react';
import RobotMascot from './RobotMascot';

const features = [
  { icon: <Brain size={18} />, title: 'RAG Pipeline', desc: 'Grounded answers with source citations' },
  { icon: <Workflow size={18} />, title: 'LangGraph Router', desc: 'Classify → retrieve / direct / refuse' },
  { icon: <Sparkles size={18} />, title: 'Multi-Corpus', desc: '15 corpora, per-subject thresholds' },
];

const techStack = ['LangChain', 'LangGraph', 'FAISS', 'Groq', 'Ollama'];

// Mirrors data/courses.json. Clicking a card calls onStart() with the sample
// query so visitors land in the chat with a ready answer streaming.
const SUBJECTS = [
  { id: 'ml-andrew-ng-c1',         name: 'ML Specialization',       icon: <Brain size={22} />,      sample: 'What is supervised learning?' },
  { id: 'genai-rag-langchain',     name: 'GenAI · RAG · LangChain', icon: <Workflow size={22} />,   sample: 'Self-attention kaise kaam karta hai?' },
  { id: 'ds-python-libraries',     name: 'Data Science · Python',   icon: <BarChart3 size={22} />,  sample: 'How do I use pandas groupby?' },
  { id: 'cs-data-structures',      name: 'Data Structures',         icon: <Boxes size={22} />,      sample: 'AVL tree aur red-black tree me kya farak hai?' },
  { id: 'cs-algorithms',           name: 'Algorithms',              icon: <Network size={22} />,    sample: 'Explain dynamic programming with an example' },
  { id: 'cs-operating-systems',    name: 'Operating Systems',       icon: <Cpu size={22} />,        sample: 'How does CPU scheduling work?' },
  { id: 'cs-dbms',                 name: 'DBMS',                    icon: <Database size={22} />,   sample: 'ACID properties matlab kya?' },
  { id: 'cs-computer-networks',    name: 'Computer Networks',       icon: <Globe size={22} />,      sample: 'TCP vs UDP — kab kaunsa use karein?' },
  { id: 'cs-software-engineering', name: 'Software Engineering',    icon: <GitBranch size={22} />,  sample: 'What does SOLID stand for?' },
  { id: 'cs-ai-general',           name: 'Artificial Intelligence', icon: <Sparkles size={22} />,   sample: 'Explain A* search algorithm' },
  { id: 'cs-compiler-design',      name: 'Compiler Design',         icon: <Code2 size={22} />,      sample: 'What is the role of a lexer?' },
  { id: 'cs-cybersecurity',        name: 'Cyber Security',          icon: <Shield size={22} />,     sample: 'What is the CIA triad in security?' },
  { id: 'cs-cloud-computing',      name: 'Cloud Computing',         icon: <Cloud size={22} />,      sample: 'IaaS vs PaaS vs SaaS — difference?' },
  { id: 'cs-web-development',      name: 'Web Development',         icon: <Layers size={22} />,     sample: 'React hooks ka use kab karte hain?' },
  { id: 'cs-programming',          name: 'Programming Fundamentals', icon: <Terminal size={22} />,  sample: 'Closure kya hota hai programming me?' },
];

export default function LandingScreen({ username, onStart, onLogout }) {
  const scrollRef = useRef(null);

  const slide = (dir) => {
    const el = scrollRef.current;
    if (!el) return;
    const card = el.querySelector('.subject-card');
    const cardWidth = card?.offsetWidth || 200;
    el.scrollBy({ left: dir * (cardWidth + 12) * 2, behavior: 'smooth' });
  };

  // Subject card click sends the sample as the first message of a new chat.
  // onStart accepts an optional initial-message argument.
  const handleSubjectClick = (sample) => onStart(sample);

  return (
    <div className="landing-screen">
      <button className="landing-logout" onClick={onLogout} aria-label="Sign out">
        <LogOut size={14} /> Sign out
      </button>

      <div className="landing-content">
        <div className="landing-robot" onClick={() => onStart()} role="button" tabIndex={0} onKeyDown={e => e.key === 'Enter' && onStart()}>
          <RobotMascot size={180} message="Click me to start chatting!" />
        </div>

        <h1 className="landing-title">RouteLM</h1>
        <p className="landing-subtitle">
          Hey <strong>{username}</strong> — your engineering study buddy. Ask in <strong>English, Hindi, or Hinglish</strong>, type or speak. 15 indexed subjects, routed to the right corpus on every query.
        </p>

        <button className="landing-start-btn" onClick={() => onStart()}>
          <span>Start Chatting</span>
          <ArrowRight size={18} />
        </button>

        <div className="subjects-header landing-subjects-header">
          <h3>15 indexed subjects · click any to start</h3>
          <div className="subjects-arrows" aria-hidden="true">
            <button type="button" className="subjects-arrow" onClick={() => slide(-1)} aria-label="Scroll subjects left">
              <ChevronLeft size={14} />
            </button>
            <button type="button" className="subjects-arrow" onClick={() => slide(1)} aria-label="Scroll subjects right">
              <ChevronRight size={14} />
            </button>
          </div>
        </div>

        <div
          className="subjects-scroll landing-subjects-scroll"
          ref={scrollRef}
          role="list"
          aria-label="Indexed subjects — click any card to ask a sample question"
        >
          {SUBJECTS.map((s) => (
            <button
              key={s.id}
              className="subject-card"
              onClick={() => handleSubjectClick(s.sample)}
              role="listitem"
              title={`Ask: ${s.sample}`}
            >
              <span className="subject-card-icon">{s.icon}</span>
              <span className="subject-card-name">{s.name}</span>
              <span className="subject-card-sample">{s.sample}</span>
            </button>
          ))}
        </div>

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
