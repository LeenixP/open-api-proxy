import { useState } from 'react';
import { X } from 'lucide-react';

interface Props {
  tags: string[];
  onChange: (tags: string[]) => void;
}

export default function ModelTagInput({ tags, onChange }: Props) {
  const [input, setInput] = useState('');

  const addTag = () => {
    const trimmed = input.trim();
    if (trimmed && !tags.includes(trimmed)) {
      onChange([...tags, trimmed]);
    }
    setInput('');
  };

  const removeTag = (tag: string) => {
    onChange(tags.filter((t) => t !== tag));
  };

  return (
    <div className="border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 bg-white dark:bg-gray-800 flex flex-wrap gap-1 min-h-[38px]">
      {tags.map((tag) => (
        <span key={tag} className="inline-flex items-center gap-1 bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 px-2 py-0.5 rounded text-xs">
          {tag}
          <button type="button" onClick={() => removeTag(tag)}><X className="w-3 h-3" /></button>
        </span>
      ))}
      <input
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTag(); } }}
        className="flex-1 min-w-[120px] outline-none text-sm bg-transparent text-gray-900 dark:text-white"
        placeholder="输入模型名，回车添加"
      />
    </div>
  );
}
