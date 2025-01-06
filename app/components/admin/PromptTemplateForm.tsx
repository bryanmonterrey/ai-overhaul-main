import React, { useState } from 'react';
import { PromptTemplate } from '../../core/personality/training/types';

interface PromptTemplateFormProps {
  onSubmit: (template: PromptTemplate) => Promise<void>;
}

export const PromptTemplateForm: React.FC<PromptTemplateFormProps> = ({ onSubmit }) => {
  const [template, setTemplate] = useState<Partial<PromptTemplate>>({
    name: '',
    content: '',
    type: '',
    is_active: true
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!template.name || !template.content || !template.type) {
      return;
    }
    
    await onSubmit({
      ...template as PromptTemplate,
      id: crypto.randomUUID(), // Generate a unique ID
    });
    
    // Reset form
    setTemplate({
      name: '',
      content: '',
      type: '',
      is_active: true
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 mb-8">
      <div>
        <label className="block text-sm font-medium mb-1">Template Name</label>
        <input
          type="text"
          value={template.name}
          onChange={(e) => setTemplate({ ...template, name: e.target.value })}
          className="w-full p-2 border rounded bg-black text-green-500 border-green-500"
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Content</label>
        <textarea
          value={template.content}
          onChange={(e) => setTemplate({ ...template, content: e.target.value })}
          className="w-full p-2 border rounded bg-black text-green-500 border-green-500 h-32"
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Type</label>
        <select
          value={template.type}
          onChange={(e) => setTemplate({ ...template, type: e.target.value })}
          className="w-full p-2 border rounded bg-black text-green-500 border-green-500"
          required
        >
          <option value="">Select type</option>
          <option value="shitpost">Shitpost</option>
          <option value="metacommentary">Meta Commentary</option>
          <option value="hornypost">Horny Technical</option>
        </select>
      </div>

      <div className="flex items-center">
        <input
          type="checkbox"
          checked={template.is_active}
          onChange={(e) => setTemplate({ ...template, is_active: e.target.checked })}
          className="mr-2"
        />
        <label className="text-sm">Active</label>
      </div>

      <button
        type="submit"
        className="w-full bg-green-500 text-black py-2 px-4 rounded hover:bg-green-400"
      >
        Add Template
      </button>
    </form>
  );
};