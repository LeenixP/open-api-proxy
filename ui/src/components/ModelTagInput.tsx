import { useState, useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { useLocale } from '../i18n/LocaleContext';

interface Props {
  tags: string[];
  onChange: (tags: string[]) => void;
}

export default function ModelTagInput({ tags, onChange }: Props) {
  const { t } = useLocale();
  const [input, setInput] = useState('');
  const [duplicateError, setDuplicateError] = useState('');
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const addTag = () => {
    const trimmed = input.trim();
    if (!trimmed) return;
    if (tags.includes(trimmed)) {
      setDuplicateError(t('providers.modelDuplicate', { name: trimmed }));
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setDuplicateError(''), 2000);
      setInput('');
      return;
    }
    onChange([...tags, trimmed]);
    setInput('');
  };

  const removeTag = (tag: string) => {
    onChange(tags.filter((t) => t !== tag));
  };

  return (
    <div>
      <div className="border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 bg-white dark:bg-gray-800 flex flex-wrap gap-1 min-h-[38px]">
        {tags.map((tag) => (
          <span key={tag} className="inline-flex items-center gap-1 bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 px-2 py-0.5 rounded text-xs">
            {tag}
            <button type="button" onClick={() => removeTag(tag)} aria-label={`Remove model ${tag}`}><X className="w-3 h-3" /></button>
          </span>
        ))}
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTag(); } }}
          className="flex-1 min-w-[120px] outline-none text-sm bg-transparent text-gray-900 dark:text-white"
          placeholder={t('providers.modelInputPlaceholder')}
        />
      </div>
      {duplicateError && (
        <p className="mt-1 text-xs text-red-500 dark:text-red-400">{duplicateError}</p>
      )}
    </div>
  );
}
