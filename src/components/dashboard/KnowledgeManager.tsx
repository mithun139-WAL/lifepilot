"use client";

import React, { useState, useEffect } from "react";
import { FileUp, Link, Trash2, Loader2, CheckCircle2, AlertCircle, FileText } from "lucide-react";
import { toast } from "sonner";
import { apiClient } from "@/lib/apiClient";

interface Source {
  source: string;
  sourceType: string;
  sourceUrl?: string;
  chunkCount: number;
  uploadedAt: string;
}

export function KnowledgeManager() {
  const [sources, setSources] = useState<Source[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [url, setUrl] = useState("");

  const fetchSources = async () => {
    try {
      const data = await apiClient.get<Source[]>("/knowledge");
      setSources(data);
    } catch (err) {
      console.error("Failed to fetch sources:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSources();
  }, []);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    console.log("📂 File selection triggered");
    const file = e.target.files?.[0];
    if (!file) {
      console.log("❌ No file selected");
      return;
    }

    console.log(`📄 Selected file: ${file.name} (${file.size} bytes)`);

    if (file.size > 5 * 1024 * 1024) {
      toast.error("File size limit is 5MB");
      return;
    }

    setUploading(true);
    const formData = new FormData();
    formData.append("file", file);

    try {
      console.log("📡 Sending to /api/knowledge/ingest...");
      await apiClient.upload("/knowledge/ingest", formData);
      console.log("✅ Ingestion successful");
      toast.success("Document ingested successfully");
      fetchSources();
    } catch (err: any) {
      console.error("❌ Ingestion failed:", err);
      toast.error(err?.message || "Upload failed");
    } finally {
      setUploading(false);
      if (e.target) e.target.value = "";
    }
  };

  const handleUrlSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url) return;

    setUploading(true);
    try {
      console.log(`📡 Fetching URL: ${url}`);
      await apiClient.post("/knowledge/ingest", { url });
      console.log("✅ URL ingestion successful");
      toast.success("URL ingested successfully");
      setUrl("");
      fetchSources();
    } catch (err: any) {
      console.error("❌ URL ingestion failed:", err);
      toast.error(err?.message || "Ingestion failed");
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (sourceName: string) => {
    if (!confirm(`Are you sure you want to delete all knowledge from "${sourceName}"?`)) return;

    try {
      await apiClient.delete(`/knowledge?source=${encodeURIComponent(sourceName)}`);
      toast.success("Source deleted");
      fetchSources();
    } catch (err) {
      toast.error("Delete failed");
    }
  };

  return (
    <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6 backdrop-blur-sm">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <FileText className="text-blue-400" />
            Knowledge Base
          </h2>
          <p className="text-sm text-slate-400">
            Upload PDFs or links to ground your AI Coach in your specific context.
          </p>
        </div>
      </div>

      {/* Upload Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
        <div className="relative">
          <label 
            htmlFor="file-upload"
            className="flex flex-col items-center justify-center border-2 border-dashed border-slate-700 rounded-xl p-6 hover:border-blue-500/50 hover:bg-blue-500/5 cursor-pointer transition-all h-full"
          >
            <FileUp className="w-8 h-8 text-slate-500 mb-2" />
            <span className="text-sm font-medium text-slate-300">Upload PDF / TXT</span>
            <span className="text-xs text-slate-500 mt-1">Max 5MB</span>
          </label>
          <input 
            id="file-upload"
            type="file" 
            className="sr-only" 
            accept=".pdf,.txt,.md,application/pdf,text/plain" 
            onChange={handleFileUpload} 
            disabled={uploading} 
          />
        </div>

        <form onSubmit={handleUrlSubmit} className="flex flex-col justify-center border-2 border-slate-800 rounded-xl p-6 bg-slate-800/30">
          <div className="flex items-center gap-2 mb-2 text-sm font-medium text-slate-300">
            <Link className="w-4 h-4 text-blue-400" />
            Import from URL
          </div>
          <div className="flex gap-2">
            <input
              type="url"
              placeholder="https://docs.example.com"
              className="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              disabled={uploading}
            />
            <button
              type="submit"
              className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
              disabled={uploading || !url}
            >
              {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Fetch"}
            </button>
          </div>
        </form>
      </div>

      {/* Source List */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider">
          Managed Sources ({sources.length})
        </h3>
        
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-slate-600" />
          </div>
        ) : sources.length === 0 ? (
          <div className="text-center py-8 border border-slate-800 rounded-xl bg-slate-900/30">
            <AlertCircle className="w-8 h-8 text-slate-700 mx-auto mb-2" />
            <p className="text-sm text-slate-500">No knowledge sources added yet.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3">
            {sources.map((src) => (
              <div
                key={src.source}
                className="flex items-center justify-between p-4 bg-slate-800/40 border border-slate-700/50 rounded-xl hover:border-slate-600 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${
                    src.sourceType === "pdf" ? "bg-red-500/10 text-red-400" : 
                    src.sourceType === "url" ? "bg-blue-500/10 text-blue-400" : 
                    "bg-slate-500/10 text-slate-400"
                  }`}>
                    {src.sourceType === "pdf" ? <FileText className="w-5 h-5" /> : <Link className="w-5 h-5" />}
                  </div>
                  <div>
                    <h4 className="text-sm font-medium text-white truncate max-w-[200px] md:max-w-md">
                      {src.source}
                    </h4>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[10px] bg-slate-700 text-slate-300 px-1.5 py-0.5 rounded uppercase">
                        {src.sourceType}
                      </span>
                      <span className="text-[10px] text-slate-500">
                        {src.chunkCount} chunks • {new Date(src.uploadedAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => handleDelete(src.source)}
                  className="p-2 text-slate-500 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-all"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
