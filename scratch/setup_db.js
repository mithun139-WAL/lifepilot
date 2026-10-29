const { PrismaClient } = require("../src/generated/prisma");
const prisma = new PrismaClient();

async function main() {
  console.log("🚀 Starting database extension setup...");
  
  try {
    // 1. Enable vector extension
    console.log("📦 Enabling pgvector extension...");
    await prisma.$executeRawUnsafe(`CREATE EXTENSION IF NOT EXISTS vector;`);
    
    // 2. Add embedding column
    console.log("📊 Adding embedding column to KnowledgeChunk...");
    await prisma.$executeRawUnsafe(`ALTER TABLE "KnowledgeChunk" ADD COLUMN IF NOT EXISTS embedding vector(1024);`);
    
    // 3. Create index
    console.log("⚡ Creating HNSW index for fast search...");
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS knowledge_chunk_embedding_idx ON "KnowledgeChunk" USING hnsw (embedding vector_cosine_ops);`);
    
    console.log("✅ Database setup complete! Knowledge Base is now active.");
  } catch (error) {
    console.error("❌ Setup failed:", error);
    if (error.message.includes("permission denied")) {
      console.log("💡 Tip: You might need to run this SQL manually in your Neon dashboard if the user lacks permissions.");
    }
  } finally {
    await prisma.$disconnect();
  }
}

main();
