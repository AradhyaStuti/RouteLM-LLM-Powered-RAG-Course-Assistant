import { memo } from 'react';
import { Video, FileText, Clock, BarChart3, BookOpen } from 'lucide-react';

function formatTime(seconds) {
  const s = Math.max(0, Math.floor(seconds || 0));
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${String(sec).padStart(2, '0')}`;
}

function formatCourse(id) {
  if (!id) return null;
  return id.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

export default memo(function SourceCard({ sources }) {
  if (!sources || sources.length === 0) return null;

  const courseIds = [...new Set(sources.map(s => s.course_id).filter(Boolean))];

  return (
    <div className="sources" role="region" aria-label="Retrieved sources">
      <div className="sources-header">
        <BarChart3 size={13} aria-hidden="true" />
        <span>Sources ({sources.length} chunks)</span>
        {courseIds.length > 0 && (
          <span className="sources-course">
            <BookOpen size={11} aria-hidden="true" />
            {courseIds.map(formatCourse).join(', ')}
          </span>
        )}
      </div>
      <div className="source-chips">
        {sources.map((s, idx) => {
          const num = s.number ?? '';
          const isVideo = s.has_timestamps === true;
          const score = Math.round((s.similarity ?? 0) * 100);
          const key = `${s.course_id || 'c'}-${num}-${idx}-${(s.text || '').slice(0, 20)}`;
          const label = s.title || (isVideo ? `Video ${num}` : `Section ${num}`);

          return (
            <div key={key} className="source-chip">
              <div className="source-top">
                <div className="source-badge">
                  {isVideo
                    ? <Video size={11} aria-hidden="true" />
                    : <FileText size={11} aria-hidden="true" />}
                  <span>{label}</span>
                </div>
                <span className={`source-score ${score >= 70 ? 'high' : score >= 50 ? 'mid' : 'low'}`}>
                  {score}%
                </span>
              </div>
              {isVideo && (
                <div className="source-time">
                  <Clock size={10} aria-hidden="true" />
                  {formatTime(s.start)} - {formatTime(s.end)}
                </div>
              )}
              {s.text && <p className="source-text">{s.text.slice(0, 100)}</p>}
            </div>
          );
        })}
      </div>
    </div>
  );
});
