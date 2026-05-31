import { useRef } from 'react';
import {
  Brain, Workflow, Database, Network, Layers, Code2, BarChart3, Boxes,
  Cpu, Shield, Cloud, Globe, Terminal, GitBranch, Sparkles,
  ChevronLeft, ChevronRight,
} from 'lucide-react';
import RobotAvatar from './RobotAvatar';

// Each subject pairs with a sample query in EN or Hinglish so visitors can
// taste-test any corpus in one click. Order mirrors data/courses.json.
const SUBJECTS = [
  { id: 'ml-andrew-ng-c1',       name: 'ML Specialization',  icon: <Brain size={22} />,      sample: 'What is supervised learning?' },
  { id: 'genai-rag-langchain',   name: 'GenAI · RAG · LangChain', icon: <Workflow size={22} />, sample: 'Self-attention kaise kaam karta hai?' },
  { id: 'ds-python-libraries',   name: 'Data Science · Python', icon: <BarChart3 size={22} />, sample: 'How do I use pandas groupby?' },
  { id: 'cs-data-structures',    name: 'Data Structures',    icon: <Boxes size={22} />,      sample: 'AVL tree aur red-black tree me kya farak hai?' },
  { id: 'cs-algorithms',         name: 'Algorithms',         icon: <Network size={22} />,    sample: 'Explain dynamic programming with an example' },
  { id: 'cs-operating-systems',  name: 'Operating Systems',  icon: <Cpu size={22} />,        sample: 'How does CPU scheduling work?' },
  { id: 'cs-dbms',               name: 'DBMS',               icon: <Database size={22} />,   sample: 'ACID properties matlab kya?' },
  { id: 'cs-computer-networks',  name: 'Computer Networks',  icon: <Globe size={22} />,      sample: 'TCP vs UDP — kab kaunsa use karein?' },
  { id: 'cs-software-engineering', name: 'Software Engineering', icon: <GitBranch size={22} />, sample: 'What does SOLID stand for?' },
  { id: 'cs-ai-general',         name: 'Artificial Intelligence', icon: <Sparkles size={22} />, sample: 'Explain A* search algorithm' },
  { id: 'cs-compiler-design',    name: 'Compiler Design',    icon: <Code2 size={22} />,      sample: 'What is the role of a lexer?' },
  { id: 'cs-cybersecurity',      name: 'Cyber Security',     icon: <Shield size={22} />,     sample: 'What is the CIA triad in security?' },
  { id: 'cs-cloud-computing',    name: 'Cloud Computing',    icon: <Cloud size={22} />,      sample: 'IaaS vs PaaS vs SaaS — difference?' },
  { id: 'cs-web-development',    name: 'Web Development',    icon: <Layers size={22} />,     sample: 'React hooks ka use kab karte hain?' },
  { id: 'cs-programming',        name: 'Programming Fundamentals', icon: <Terminal size={22} />, sample: 'Closure kya hota hai programming me?' },
];

export default function WelcomeScreen({ onSuggestionClick }) {
  const scrollRef = useRef(null);

  const slide = (dir) => {
    const el = scrollRef.current;
    if (!el) return;
    const cardWidth = el.querySelector('.subject-card')?.offsetWidth || 200;
    el.scrollBy({ left: dir * (cardWidth + 12) * 2, behavior: 'smooth' });
  };

  return (
    <div className="welcome">
      <div className="welcome-bot">
        <RobotAvatar size={48} />
        <div>
          <h2>RouteLM</h2>
          <p>Ask in English, Hindi, or Hinglish. Type or tap the mic. I'll route your question to the right corpus.</p>
        </div>
      </div>

      <div className="subjects-header">
        <h3>Browse subjects</h3>
        <div className="subjects-arrows" aria-hidden="true">
          <button
            type="button"
            className="subjects-arrow"
            onClick={() => slide(-1)}
            aria-label="Scroll subjects left"
          >
            <ChevronLeft size={14} />
          </button>
          <button
            type="button"
            className="subjects-arrow"
            onClick={() => slide(1)}
            aria-label="Scroll subjects right"
          >
            <ChevronRight size={14} />
          </button>
        </div>
      </div>

      <div
        className="subjects-scroll"
        ref={scrollRef}
        role="list"
        aria-label="Indexed subjects — click any card to ask a sample question"
      >
        {SUBJECTS.map((s) => (
          <button
            key={s.id}
            className="subject-card"
            onClick={() => onSuggestionClick(s.sample)}
            role="listitem"
            title={`Ask: ${s.sample}`}
          >
            <span className="subject-card-icon">{s.icon}</span>
            <span className="subject-card-name">{s.name}</span>
            <span className="subject-card-sample">{s.sample}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
