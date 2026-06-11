export async function uploadFile(url: string, file: File, token: string): Promise<string> {
  const fd = new FormData();
  fd.append("file", file);
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`
    },
    body: fd
  });
  
  if (!res.ok) {
    throw new Error("Failed to upload file");
  }
  
  const data = await res.json();
  return data.url;
}
