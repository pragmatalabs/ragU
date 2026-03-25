import { X, Github, Mail, Linkedin } from "lucide-react";

export function AboutModal({ onClose }: { onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl max-w-md w-full mx-4 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative px-6 pt-6 pb-4 text-center">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-gray-500 hover:text-white transition-colors"
          >
            <X size={18} />
          </button>
          <div className="text-4xl mb-3">🍲</div>
          <h2 className="text-xl font-bold text-white">ragU</h2>
          <p className="text-xs text-gray-500 mt-1">Local LLM & RAG Playground</p>
        </div>

        <div className="px-6 pb-6 space-y-4">
          <p className="text-sm text-gray-300 text-center leading-relaxed">
            This is an experimental playground for testing LLMs, RAG pipelines,
            and vector databases locally. The source code is free and open on GitHub
            — use it at your own discretion.
          </p>

          <div className="bg-gray-800/50 border border-gray-800 rounded-xl p-4 space-y-2">
            <p className="text-xs text-gray-500 uppercase tracking-wider font-medium">Author</p>
            <p className="text-sm font-semibold text-white">Julian De La Rosa</p>
            <div className="flex flex-col gap-1.5 text-xs text-gray-400">
              <a href="mailto:juliandelarosa@icloud.com" className="flex items-center gap-2 hover:text-blue-400 transition-colors">
                <Mail size={12} /> juliandelarosa@icloud.com
              </a>
              <a href="https://github.com/pragmatalabs/ragU" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 hover:text-blue-400 transition-colors">
                <Github size={12} /> github.com/pragmatalabs/ragU
              </a>
              <a href="https://www.linkedin.com/in/jdlrs/" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 hover:text-blue-400 transition-colors">
                <Linkedin size={12} /> linkedin.com/in/jdlrs
              </a>
            </div>
          </div>

          <p className="text-center text-[10px] text-gray-600">
            MIT License &middot; 2026 &middot; Built with curiosity
          </p>
        </div>
      </div>
    </div>
  );
}
