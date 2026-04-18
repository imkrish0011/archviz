import { memo, useState, useRef, useEffect } from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import { useArchStore } from '../../store/useArchStore';
import type { ArchNodeData } from '../../types';

function StickyNoteNode({ id, data, selected }: NodeProps) {
  const d = data as unknown as ArchNodeData;
  const updateNodeData = useArchStore(s => s.updateNodeData);
  const [isEditing, setIsEditing] = useState(false);
  const [text, setText] = useState(d.architecturalNote || 'Double-click to edit note...');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus();
      // Auto-resize
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
    }
  }, [isEditing]);

  const handleBlur = () => {
    setIsEditing(false);
    updateNodeData(id, { architecturalNote: text });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Save on Cmd+Enter or Ctrl+Enter
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      handleBlur();
    }
  };

  const selectedClass = selected ? 'selected' : '';

  return (
    <div 
      className={`sticky-note-node ${selectedClass}`}
      onDoubleClick={() => setIsEditing(true)}
    >
      <Handle type="target" position={Position.Left} style={{ opacity: 0 }} />
      <Handle type="source" position={Position.Right} style={{ opacity: 0 }} />
      
      <div className="sticky-note-header">
        <span className="sticky-note-pin" />
      </div>
      
      {isEditing ? (
        <textarea
          ref={textareaRef}
          className="sticky-note-input"
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            e.target.style.height = 'auto';
            e.target.style.height = e.target.scrollHeight + 'px';
          }}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          placeholder="Write architecture notes here..."
        />
      ) : (
        <div className="sticky-note-content">
          {text.split('\n').map((line, i) => (
            <p key={i}>
              {line || '\u00A0'}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

export default memo(StickyNoteNode);
