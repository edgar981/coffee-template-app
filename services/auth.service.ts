export async function getCurrentUser() {
  return {
    id: "u1",
    full_name: "Edgar Navarro",
    email: "edgar@example.com",
    role: "customer",
  };
}

export async function logout() {
  console.log("logout");
}