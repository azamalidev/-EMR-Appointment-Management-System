import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    name: "EMR Appointment Management",
    stack: "Express + MongoDB + Mongoose (backend) / Next.js + React (frontend)",
    backend: "/api/v1 (route via ?XTransformPort=4000)",
  });
}