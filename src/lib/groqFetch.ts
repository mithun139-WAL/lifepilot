export async function groqFetchWithRetry(
    url: string,
    options: RequestInit,
    retries = 3,
    delay = 2000 
  ): Promise<Response> {
    for (let i = 0; i <= retries; i++) {
      const res = await fetch(url, options);
  
      if (res.ok) {
        return res;
      }
  
      if (res.status === 429 && i < retries) {
        console.warn(`⚠️ Rate limit hit. Retrying in ${delay}ms...`);
        await new Promise((resolve) => setTimeout(resolve, delay));
        delay *= 2; 
        continue;
      }
  
      throw new Error(`Groq API failed: ${res.status} ${res.statusText}`);
    }
  
    throw new Error("Max retries reached");
  }