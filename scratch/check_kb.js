const { PrismaClient } = require("../src/generated/prisma");
const prisma = new PrismaClient();

async function main() {
  console.log("🔍 Checking Knowledge Base status...");
  
  try {
    const chunkCount = await prisma.knowledgeChunk.count();
    console.log(`Total chunks in DB: ${chunkCount}`);
    
    if (chunkCount > 0) {
      const chunksWithEmbedding = await prisma.$queryRaw`
        SELECT count(*) as count FROM "KnowledgeChunk" WHERE embedding IS NOT NULL
      `;
      console.log(`Chunks with valid embeddings:`, chunksWithEmbedding);
      
      const sample = await prisma.knowledgeChunk.findFirst({
        select: { id: true, source: true, sourceType: true, content: true }
      });
      console.log("Sample chunk:", {
        id: sample.id,
        source: sample.source,
        type: sample.sourceType,
        contentPreview: sample.content.substring(0, 50) + "..."
      });
    } else {
      console.log("⚠️ No chunks found in the database. Ingestion might have failed or not been run.");
    }
  } catch (error) {
    console.error("❌ Diagnostic failed:", error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
