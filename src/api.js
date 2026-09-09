export const API_BASE = (process.env.REACT_APP_API_URL || "/api").replace(/\/+$/, "");

export async function readApiResponse(response) {
  let data;
  try {
    data = await response.json();
  } catch (error) {
    if (error.name === "AbortError") throw error;
    throw new Error(`Course Compass received an invalid server response (HTTP ${response.status}). Please retry. If this continues, the deployed API needs attention.`);
  }
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new Error("Course Compass received an invalid server response. Please retry.");
  }
  return data;
}
