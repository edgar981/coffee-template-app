export async function createOrder(
  payload: any
) {
  console.log("Creating order:", payload);

  await new Promise((resolve) =>
    setTimeout(resolve, 1500)
  );

  return {
    success: true,
  };
}