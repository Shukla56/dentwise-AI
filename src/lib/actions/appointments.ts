"use server";

import { auth, currentUser } from "@clerk/nextjs/server";
import { prisma } from "../prisma";
import { AppointmentStatus } from "@prisma/client";

function transformAppointment(appointment: any) {
  return {
    ...appointment,
    patientName: `${appointment.user.firstName || ""} ${appointment.user.lastName || ""}`.trim(),
    patientEmail: appointment.user.email,
    doctorName: appointment.doctor.name,
    doctorImageUrl: appointment.doctor.imageUrl || "",
    date: appointment.date.toISOString().split("T")[0],
  };
}

// ✅ Utility: Ensure Prisma user exists for current Clerk user
async function ensureUserExists(clerkId: string) {
  const clerkData = await currentUser();
  if (!clerkData) throw new Error("No Clerk user found");

  let user = await prisma.user.findUnique({ where: { clerkId } });
  if (!user) {
    user = await prisma.user.create({
      data: {
        clerkId,
        email: clerkData.emailAddresses[0].emailAddress,
        firstName: clerkData.firstName ?? "",
        lastName: clerkData.lastName ?? "",
        phone: clerkData.phoneNumbers[0]?.phoneNumber ?? "",
      },
    });
    console.log("✅ New user created in Prisma:", user.email);
  }
  return user;
}

// 📋 Get All Appointments (Admin view)
export async function getAppointments() {
  try {
    const appointments = await prisma.appointment.findMany({
      include: {
        user: {
          select: { firstName: true, lastName: true, email: true },
        },
        doctor: { select: { name: true, imageUrl: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return appointments.map(transformAppointment);
  } catch (error) {
    console.log("Error fetching appointments:", error);
    throw new Error("Failed to fetch appointments");
  }
}

// 👤 Get Logged-in User Appointments
export async function getUserAppointments() {
  try {
    const { userId } = await auth();
    if (!userId) throw new Error("You must be logged in to view appointments");

    // ✅ Ensure user exists in Prisma
    const user = await ensureUserExists(userId);

    const appointments = await prisma.appointment.findMany({
      where: { userId: user.id },
      include: {
        user: { select: { firstName: true, lastName: true, email: true } },
        doctor: { select: { name: true, imageUrl: true } },
      },
      orderBy: [{ date: "asc" }, { time: "asc" }],
    });

    return appointments.map(transformAppointment);
  } catch (error) {
    console.error("Error fetching user appointments:", error);
    throw new Error("Failed to fetch user appointments");
  }
}

// 📊 Get Appointment Stats for Logged-in User
export async function getUserAppointmentStats() {
  try {
    const { userId } = await auth();
    if (!userId) throw new Error("You must be authenticated");

    // ✅ Ensure user exists in Prisma
    const user = await ensureUserExists(userId);

    const [totalCount, completedCount] = await Promise.all([
      prisma.appointment.count({ where: { userId: user.id } }),
      prisma.appointment.count({
        where: { userId: user.id, status: "COMPLETED" },
      }),
    ]);

    return {
      totalAppointments: totalCount,
      completedAppointments: completedCount,
    };
  } catch (error) {
    console.error("Error fetching user appointment stats:", error);
    return { totalAppointments: 0, completedAppointments: 0 };
  }
}

// ⏰ Get Booked Time Slots
export async function getBookedTimeSlots(doctorId: string, date: string) {
  try {
    const appointments = await prisma.appointment.findMany({
      where: {
        doctorId,
        date: new Date(date),
        status: {
          in: ["CONFIRMED", "COMPLETED"],
        },
      },
      select: { time: true },
    });

    return appointments.map((a) => a.time);
  } catch (error) {
    console.error("Error fetching booked time slots:", error);
    return [];
  }
}

// 🩺 Book a New Appointment
interface BookAppointmentInput {
  doctorId: string;
  date: string;
  time: string;
  reason?: string;
}

export async function bookAppointment(input: BookAppointmentInput) {
  try {
    const { userId } = await auth();
    if (!userId) throw new Error("You must be logged in to book an appointment");
    if (!input.doctorId || !input.date || !input.time)
      throw new Error("Doctor, date, and time are required");

    // ✅ Ensure user exists in Prisma
    const user = await ensureUserExists(userId);

    const appointment = await prisma.appointment.create({
      data: {
        userId: user.id,
        doctorId: input.doctorId,
        date: new Date(input.date),
        time: input.time,
        reason: input.reason || "General consultation",
        status: "CONFIRMED",
      },
      include: {
        user: { select: { firstName: true, lastName: true, email: true } },
        doctor: { select: { name: true, imageUrl: true } },
      },
    });

    return transformAppointment(appointment);
  } catch (error) {
    console.error("Error booking appointment:", error);
    throw new Error("Failed to book appointment. Please try again later.");
  }
}

// 🔄 Update Appointment Status
export async function updateAppointmentStatus(input: {
  id: string;
  status: AppointmentStatus;
}) {
  try {
    const appointment = await prisma.appointment.update({
      where: { id: input.id },
      data: { status: input.status },
    });

    return appointment;
  } catch (error) {
    console.error("Error updating appointment:", error);
    throw new Error("Failed to update appointment");
  }
}
