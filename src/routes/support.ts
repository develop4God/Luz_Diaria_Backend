import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { prisma } from "../prisma";
import {
  getBestSnapshotForUser,
  getSnapshotById,
  getCRDateString,
} from "../streak-snapshot-service";
import { requireRole } from "../middleware/rbac";
import { randomUUID } from "crypto";

const supportRouter = new Hono();

function shortId(len = 8): string {
  return randomUUID().replace(/-/g, "").slice(0, len).toUpperCase();
}

// ─── Types ────────────────────────────────────────────────────────────────────

type TicketType =
  | "streak_missing"
  | "devotional_not_counted"
  | "audio_tts"
  | "notification"
  | "reward_drop"
  | "purchase_not_delivered"
  | "feedback";

type TicketStatus = "open" | "auto_fixed" | "needs_human" | "waiting_user" | "closed";

type EventActor = "USER" | "SYSTEM" | "ADMIN";
type EventType =
  | "CREATED"
  | "STATUS_CHANGE"
  | "SYSTEM_REPLY"
  | "ADMIN_REPLY"
  | "USER_REPLY"
  | "AUTO_FIX"
  | "COMPENSATION"
  | "REQUEST_INFO"
  | "CLOSED"
  | "RATING";

interface BotPreview {
  summary: string;
  userMessageEs: string;
  userMessageEn: string;
  action: "auto_fixed" | "needs_human" | "info_only";
  // Snapshot comparison data for admin display
  snapshotComparison?: {
    snapshotDate: string | null;
    snapshotId: string | null;
    snapshotStreak: number | null;
    currentStreak: number;
    claimedStreak: number;
    diffDays: number | null;
    devotionalTodayCR: boolean;
    lastDevotionalDate: string | null;
    escalationReason: string;
  };
}

// ─── Schemas ──────────────────────────────────────────────────────────────────

const createTicketSchema = z.object({
  userId: z.string().min(1),
  type: z.enum([
    "streak_missing",
    "devotional_not_counted",
    "audio_tts",
    "notification",
    "reward_drop",
    "purchase_not_delivered",
    "feedback",
  ]),
  claimedStreak: z.number().int().min(0).optional().default(0),
  claimedDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .default(() => getCRDateString(0)),
  clientClaim: z.record(z.string(), z.unknown()).optional().default({}),
  purchaseItemId: z.string().optional(),   // storeItemId of the purchased item
  purchaseBundleId: z.string().optional(), // bundleId if it was a bundle
});

// ─── Incident Number Generator ────────────────────────────────────────────────

async function generateIncidentNumber(): Promise<string> {
  const today = new Date();
  const dateStr = today.toISOString().slice(0, 10).replace(/-/g, ""); // YYYYMMDD

  // Count tickets created today to get a sequential number
  const startOfDay = new Date(today.toISOString().slice(0, 10) + "T00:00:00.000Z");
  const endOfDay = new Date(today.toISOString().slice(0, 10) + "T23:59:59.999Z");

  const countToday = await prisma.supportTicket.count({
    where: {
      createdAt: { gte: startOfDay, lte: endOfDay },
    },
  });

  const seq = String(countToday + 1).padStart(4, "0");
  const candidate = `LD-${dateStr}-${seq}`;

  // Ensure uniqueness (race condition guard)
  const existing = await prisma.supportTicket.findUnique({
    where: { incidentNumber: candidate },
  });
  if (existing) {
    // Fallback: append random suffix
    return `LD-${dateStr}-${seq}-${shortId(4)}`;
  }
  return candidate;
}

// ─── Event Helper ─────────────────────────────────────────────────────────────

async function addEvent(
  ticketId: string,
  actor: EventActor,
  type: EventType,
  message: string,
  meta?: Record<string, unknown>
): Promise<void> {
  await prisma.supportTicketEvent.create({
    data: {
      id: randomUUID(),
      ticketId,
      actor,
      type,
      message,
      meta: JSON.stringify(meta ?? {}),
    },
  });
}

// ─── Helper: build BotPreview ─────────────────────────────────────────────────

function buildBotPreview(
  type: TicketType,
  status: TicketStatus,
  resolutionNote: string | null,
  claimedStreak: number,
  clientClaim: Record<string, unknown>,
  snapshotComparison?: BotPreview["snapshotComparison"]
): BotPreview {
  const base: Pick<BotPreview, "snapshotComparison"> = { snapshotComparison };

  switch (type) {
    case "streak_missing": {
      if (status === "auto_fixed") {
        return {
          summary: `Racha corregida automáticamente (claimed: ${claimedStreak})`,
          userMessageEs: `¡Tu racha fue restaurada! El sistema detectó una pequeña diferencia y la corrigió de forma automática. Tu racha no disminuirá.`,
          userMessageEn: `Your streak has been restored! The system detected a small discrepancy and fixed it automatically. Your streak is safe.`,
          action: "auto_fixed",
          ...base,
        };
      }
      return {
        summary: `Racha perdida — requiere revisión manual`,
        userMessageEs: `Hola, recibimos tu reporte sobre tu racha. La diferencia detectada es demasiado grande para una corrección automática, por lo que un moderador revisará tu caso pronto. Gracias por reportarlo.`,
        userMessageEn: `Hello, we received your streak report. The detected difference is too large for an automatic fix, so a moderator will review your case soon. Thank you for reporting it.`,
        action: "needs_human",
        ...base,
      };
    }
    case "devotional_not_counted": {
      if (status === "auto_fixed") {
        return {
          summary: `Devocional reconocido automáticamente`,
          userMessageEs: `Tu devocional fue registrado correctamente. Si el conteo no se refleja de inmediato, cierra y abre la app.`,
          userMessageEn: `Your devotional was registered correctly. If the count doesn't show immediately, close and reopen the app.`,
          action: "auto_fixed",
          ...base,
        };
      }
      return {
        summary: `Devocional no contado — requiere revisión`,
        userMessageEs: `Recibimos tu reporte. No encontramos una forma automática de verificar tu devocional del día indicado. Un moderador revisará tu caso. Gracias.`,
        userMessageEn: `We received your report. We couldn't automatically verify your devotional for the indicated day. A moderator will review your case. Thank you.`,
        action: "needs_human",
        ...base,
      };
    }
    case "audio_tts": {
      const issue = (clientClaim.issue as string) || "unknown";
      const device = (clientClaim.device as string) || "no especificado";
      const os = (clientClaim.os as string) || "no especificado";
      const ttsVoiceName = (clientClaim.ttsVoiceName as string) || "";
      const ttsVoiceIdentifier = (clientClaim.ttsVoiceIdentifier as string) || "";
      const ttsNeedsUserAction = !!(clientClaim.ttsNeedsUserAction);
      const ttsVoiceScore = typeof clientClaim.ttsVoiceScore === "number" ? clientClaim.ttsVoiceScore : null;

      // voz_rara: special case — provide iOS voice install steps, never auto-fix
      if (issue === "voz_rara") {
        const voiceInfo = ttsVoiceName
          ? `Voz seleccionada: "${ttsVoiceName}"${ttsVoiceScore !== null ? ` (score: ${ttsVoiceScore})` : ""}.`
          : "No se pudo detectar la voz del dispositivo.";

        const userMessageEs =
          `Hola 👋 Recibimos tu reporte sobre la voz de narración. ` +
          `Esta app usa las voces nativas de iOS, y algunos dispositivos no tienen instalada una voz de alta calidad en español.\n\n` +
          `📲 Para instalar una mejor voz:\n` +
          `1. Ve a Ajustes → Accesibilidad → Contenido hablado → Voces\n` +
          `2. Elige Español (México) o Español (Latinoamérica)\n` +
          `3. Descarga "Paulina" (o la mejor voz disponible) y actívala\n` +
          `4. Cierra completamente la app y vuelve a abrirla\n\n` +
          `Si después de esto la voz sigue sonando rara, escríbenos aquí mismo con tu versión de iOS y modelo de iPhone. También puedes enviarnos una grabación corta a chaviticogames@gmail.com`;

        const userMessageEn =
          `Hi 👋 We received your report about the narration voice. ` +
          `This app uses iOS native voices, and some devices don't have a high-quality Spanish voice installed.\n\n` +
          `📲 To install a better voice:\n` +
          `1. Go to Settings → Accessibility → Spoken Content → Voices\n` +
          `2. Choose Spanish (Mexico) or Spanish (Latin America)\n` +
          `3. Download "Paulina" (or the best available voice) and enable it\n` +
          `4. Fully close the app and reopen it\n\n` +
          `If the voice still sounds robotic after this, reply here with your iOS version and iPhone model. You can also email a short screen recording to chaviticogames@gmail.com`;

        return {
          summary: `Audio/TTS: voz_rara (${os}) | voz: ${ttsVoiceName || "?"} | score: ${ttsVoiceScore ?? "?"} | needsAction: ${ttsNeedsUserAction}`,
          userMessageEs,
          userMessageEn,
          action: "info_only",
          ...base,
        };
      }

      // Standard audio issues
      const steps =
        issue === "no_sound"
          ? "1) Verifica que el volumen del dispositivo esté activo. 2) Cierra y abre la app. 3) Ve a Ajustes > Sonido y asegúrate de que la música esté activada."
          : issue === "repeats"
          ? "1) Cierra y abre la app. 2) Si persiste, ve a Ajustes del sistema > Apps > Luz Diaria > Borrar caché."
          : issue === "cuts"
          ? "1) Verifica tu conexión a internet. 2) El audio puede cortarse si la señal es débil. Intenta con WiFi."
          : "1) Cierra y abre la app. 2) Verifica tu conexión a internet.";
      return {
        summary: `Audio/TTS: ${issue} (${os}/${device})`,
        userMessageEs: `Hola, recibimos tu reporte de audio (${issue}). Pasos a seguir: ${steps} Si el problema persiste, escríbenos y lo escalaremos.`,
        userMessageEn: `Hello, we received your audio report (${issue}). Steps to try: ${steps} If the issue persists, let us know and we'll escalate it.`,
        action: "info_only",
        ...base,
      };
    }
    case "notification": {
      const issue = (clientClaim.issue as string) || "unknown";
      const hour = clientClaim.scheduledHour;
      const enabled = clientClaim.enabled;
      const stepsEs =
        issue === "not_received"
          ? `1) Verifica que las notificaciones estén activadas en Ajustes > Notificaciones. 2) Hora programada: ${hour !== undefined ? hour + ":00" : "no registrada"}. 3) En iOS, ve a Configuración > Luz Diaria > Notificaciones y confirma que estén habilitadas.`
          : issue === "late"
          ? `Las notificaciones pueden llegar tarde si el sistema operativo las agrupa. Esto es normal en iOS con el modo bajo consumo activo.`
          : `Si recibes notificaciones duplicadas, por favor cierra sesión y vuelve a activarlas en Ajustes > Notificaciones.`;
      return {
        summary: `Notificación: ${issue} (habilitado: ${enabled ?? "?"})`,
        userMessageEs: `Hola, recibimos tu reporte de notificaciones (${issue}). ${stepsEs}`,
        userMessageEn: `Hello, we received your notification report (${issue}). Please check your device notification settings and make sure notifications are enabled for Luz Diaria.`,
        action: "info_only",
        ...base,
      };
    }
    case "reward_drop": {
      const issue = (clientClaim.issue as string) || "unknown";
      const dropId = (clientClaim.dropId as string) || "";
      return {
        summary: `Regalo/Drop: ${issue}${dropId ? " (dropId: " + dropId.slice(0, 8) + ")" : ""}`,
        userMessageEs: `Hola, recibimos tu reporte sobre el regalo (${issue}). ${
          issue === "not_received"
            ? "Los regalos pueden tardar hasta 24 horas en aparecer. Si transcurrido ese tiempo no aparece, un moderador revisará tu cuenta."
            : "Si el cofre no abre, cierra y abre la app. Si el problema persiste, un moderador revisará manualmente."
        }`,
        userMessageEn: `Hello, we received your gift/drop report (${issue}). ${
          issue === "not_received"
            ? "Gifts can take up to 24 hours to appear. If it still doesn't show after that time, a moderator will review your account."
            : "If the chest won't open, close and reopen the app. If the issue persists, a moderator will review it manually."
        }`,
        action: "needs_human",
        ...base,
      };
    }
    case "purchase_not_delivered": {
      const purchaseItemId = (clientClaim.purchaseItemId as string) || "";
      const purchaseBundleId = (clientClaim.purchaseBundleId as string) || "";
      const targetLabel = purchaseBundleId || purchaseItemId || "desconocido";
      if (status === "auto_fixed") {
        return {
          summary: `Compra no entregada: ${targetLabel} — corregido automáticamente`,
          userMessageEs: `¡Listo! Revisamos tu compra y el ítem ya fue agregado a tu inventario. Si no lo ves de inmediato, cierra y abre la app para que se sincronice.`,
          userMessageEn: `Done! We checked your purchase and the item has been added to your inventory. If you don't see it right away, close and reopen the app to sync.`,
          action: "auto_fixed",
          ...base,
        };
      }
      return {
        summary: `Compra no entregada: ${targetLabel} — requiere revisión`,
        userMessageEs: `Recibimos tu reporte sobre tu compra (${targetLabel}). Un moderador revisará tu caso pronto para verificar la transacción y gestionar la entrega del ítem. Gracias por reportarlo.`,
        userMessageEn: `We received your purchase report (${targetLabel}). A moderator will review your case soon to verify the transaction and handle the item delivery. Thank you for reporting.`,
        action: "needs_human",
        ...base,
      };
    }
    case "feedback": {
      const title = (clientClaim.title as string) || "";
      const comment = (clientClaim.comment as string) || "";
      const preview = comment.length > 60 ? comment.slice(0, 60) + "…" : comment;
      return {
        summary: title ? `Comentario: "${title}"` : `Sugerencia/Comentario — ${preview}`,
        userMessageEs: `¡Gracias por tomarte el tiempo de escribirnos! 🙏\n\nRecibimos tu comentario y lo revisaremos con atención. Si tienes más detalles o preguntas, puedes respondernos aquí mismo. Recibirás una respuesta pronto del equipo.`,
        userMessageEn: `Thank you for taking the time to write to us! 🙏\n\nWe received your feedback and will review it carefully. If you have more details or questions, you can reply right here. You'll receive a response from the team soon.`,
        action: "needs_human",
        ...base,
      };
    }
    default:
      return {
        summary: "Ticket recibido",
        userMessageEs: "Tu reporte fue recibido y será revisado.",
        userMessageEn: "Your report has been received and will be reviewed.",
        action: "info_only",
        ...base,
      };
  }
}

// ─── Routes ───────────────────────────────────────────────────────────────────

// POST /api/support/ticket — create a ticket
supportRouter.post(
  "/ticket",
  zValidator("json", createTicketSchema),
  async (c) => {
    const { userId, type, claimedStreak, claimedDate, clientClaim, purchaseItemId, purchaseBundleId } =
      c.req.valid("json");

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, streakCurrent: true, devotionalsCompleted: true },
    });

    if (!user) {
      return c.json({ success: false, error: "User not found" }, 404);
    }

    // Use CR today as the ticket reference date (for snapshot lookup)
    const ticketDateCR = getCRDateString(0);

    // Find the best snapshot at or before today
    const snapshot = await getBestSnapshotForUser(userId, ticketDateCR);

    const beforeState = JSON.stringify({
      streakCurrent: user.streakCurrent,
      devotionalsCompleted: user.devotionalsCompleted,
    });

    let status: TicketStatus = "open";
    let resolutionNote: string | null = null;
    let afterState = beforeState;
    let escalationReason = "No auto-fix attempted";

    // Build snapshot comparison for admin display
    const snapshotComparison: BotPreview["snapshotComparison"] = {
      snapshotDate: snapshot?.snapshotDate ?? null,
      snapshotId: snapshot?.id ?? null,
      snapshotStreak: snapshot?.streak ?? null,
      currentStreak: user.streakCurrent,
      claimedStreak,
      diffDays: snapshot ? Math.abs(snapshot.streak - claimedStreak) : null,
      devotionalTodayCR: false,
      lastDevotionalDate: snapshot?.lastDevotionalDateCompleted ?? null,
      escalationReason: "",
    };

    // Track what happened for event creation
    let autoFixApplied: string | null = null;

    // Auto-fix logic: only for streak_missing and devotional_not_counted
    if (type === "streak_missing" || type === "devotional_not_counted") {
      if (!snapshot) {
        status = "needs_human";
        escalationReason = "No snapshot found for this user";
        resolutionNote = `Sin snapshot disponible para verificación. Revisión manual requerida.`;
        console.warn(`[Support] Ticket for ${userId}: no snapshot found. Escalating.`);
      } else {
        const snapshotStreak = snapshot.streak;
        const diff = Math.abs(snapshotStreak - claimedStreak);

        if (type === "streak_missing") {
          if (snapshotStreak >= 1 && diff <= 1) {
            const newStreak = Math.max(snapshotStreak, user.streakCurrent);
            await prisma.user.update({
              where: { id: userId },
              data: { streakCurrent: newStreak },
            });
            afterState = JSON.stringify({
              streakCurrent: newStreak,
              devotionalsCompleted: user.devotionalsCompleted,
            });
            status = "auto_fixed";
            escalationReason = "";
            resolutionNote = `Auto-corregido con snapshot del ${snapshot.snapshotDate}. Snapshot=${snapshotStreak}, claimed=${claimedStreak}, aplicado=${newStreak}.`;
            autoFixApplied = `Racha restaurada: ${user.streakCurrent} → ${newStreak} (snapshot del ${snapshot.snapshotDate})`;
            console.log(`[Support] Auto-fixed streak for ${userId}: ${user.streakCurrent}→${newStreak}`);
          } else {
            status = "needs_human";
            escalationReason =
              snapshotStreak < 1
                ? `Snapshot streak is 0 (user had no streak at snapshot time)`
                : `Diff too large: snapshot=${snapshotStreak}, claimed=${claimedStreak}, diff=${diff}`;
            resolutionNote = `Snapshot del ${snapshot.snapshotDate}: racha=${snapshotStreak}, reclamado=${claimedStreak}, diff=${diff}. Requiere revisión.`;
            console.warn(`[Support] Ticket ${userId}: diff=${diff}, escalating.`);
          }
        } else {
          const snapshotDevDate = snapshot.lastDevotionalDateCompleted;
          const todayCompletion = await prisma.devotionalCompletion.findFirst({
            where: { userId, devotionalDate: claimedDate },
          });

          snapshotComparison.devotionalTodayCR = !!todayCompletion;

          if (todayCompletion) {
            status = "auto_fixed";
            escalationReason = "";
            resolutionNote = `Devocional del ${claimedDate} ya registrado en la base de datos.`;
            autoFixApplied = `Devocional del ${claimedDate} verificado (ya estaba en la base de datos)`;
          } else if (snapshotDevDate === claimedDate) {
            await prisma.devotionalCompletion.upsert({
              where: { userId_devotionalDate: { userId, devotionalDate: claimedDate } },
              create: { userId, devotionalDate: claimedDate, completedAt: new Date() },
              update: {},
            });
            afterState = JSON.stringify({
              streakCurrent: user.streakCurrent,
              devotionalsCompleted: user.devotionalsCompleted + 1,
            });
            status = "auto_fixed";
            escalationReason = "";
            resolutionNote = `Devocional del ${claimedDate} verificado por snapshot (${snapshot.snapshotDate}) y registrado.`;
            autoFixApplied = `Devocional del ${claimedDate} registrado (verificado con snapshot del ${snapshot.snapshotDate})`;
            console.log(`[Support] Auto-fixed devotional for ${userId} on ${claimedDate}`);
          } else {
            status = "needs_human";
            escalationReason =
              !snapshotDevDate
                ? `Snapshot no tiene fecha de devocional registrada`
                : `Snapshot lastDevotionalDate=${snapshotDevDate} no coincide con claimedDate=${claimedDate}`;
            resolutionNote = `Snapshot del ${snapshot.snapshotDate}: lastDev=${snapshotDevDate ?? "null"}, reclamado=${claimedDate}. Sin evidencia para auto-corregir.`;
            console.warn(`[Support] Devotional ticket ${userId}: evidence mismatch, escalating.`);
          }
        }
      }
    } else if (type === "purchase_not_delivered") {
      // Auto-resolve: check if the item was actually delivered, if not grant it
      const targetBundleId = purchaseBundleId ?? (clientClaim.purchaseBundleId as string | undefined);
      const targetItemId = purchaseItemId ?? (clientClaim.purchaseItemId as string | undefined);
      const resolvedBundleId = targetBundleId || undefined;
      const resolvedItemId = targetItemId || undefined;

      if (!resolvedBundleId && !resolvedItemId) {
        status = "needs_human";
        escalationReason = "No item or bundle ID provided in claim";
        resolutionNote = "No se especificó un ítem o bundle. Revisión manual requerida.";
      } else if (resolvedBundleId) {
        // Bundle purchase — find items that belong to this bundle
        const bundleItems = await prisma.storeItem.findMany({
          where: { bundleId: resolvedBundleId },
          select: { id: true, nameEs: true },
        });

        if (bundleItems.length === 0) {
          status = "needs_human";
          escalationReason = `Bundle ${resolvedBundleId} has no items in catalog`;
          resolutionNote = `No se encontraron ítems para el bundle ${resolvedBundleId}. Revisión manual requerida.`;
        } else {
          const ownedItems = await prisma.userInventory.findMany({
            where: { userId },
            select: { itemId: true },
          });
          const ownedIds = new Set(ownedItems.map((i) => i.itemId));

          const granted: string[] = [];
          for (const item of bundleItems) {
            if (!ownedIds.has(item.id)) {
              try {
                await prisma.userInventory.create({
                  data: {
                    userId,
                    itemId: item.id,
                    source: "support_grant",
                    acquiredAt: new Date(),
                  },
                });
                granted.push(item.nameEs);
              } catch {
                // ignore duplicate constraint errors (race condition)
              }
            }
          }

          if (granted.length > 0) {
            status = "auto_fixed";
            escalationReason = "";
            resolutionNote = `Se entregaron ${granted.length} ítem(s) del bundle ${resolvedBundleId}: ${granted.join(", ")}.`;
            autoFixApplied = `Bundle ${resolvedBundleId}: ${granted.length} ítem(s) entregado(s) — ${granted.join(", ")}`;
            afterState = JSON.stringify({
              streakCurrent: user.streakCurrent,
              devotionalsCompleted: user.devotionalsCompleted,
              grantedItems: granted,
            });
            console.log(`[Support] Auto-granted bundle items for ${userId}: ${granted.join(", ")}`);
          } else {
            status = "auto_fixed";
            escalationReason = "";
            resolutionNote = `Todos los ítems del bundle ${resolvedBundleId} ya estaban en tu inventario.`;
            autoFixApplied = `Bundle ${resolvedBundleId}: todos los ítems ya estaban en inventario`;
          }
        }
      } else if (resolvedItemId) {
        // Single item purchase
        const storeItem = await prisma.storeItem.findUnique({
          where: { id: resolvedItemId },
          select: { id: true, nameEs: true },
        });

        if (!storeItem) {
          status = "needs_human";
          escalationReason = `Item ${resolvedItemId} not found in store catalog`;
          resolutionNote = `El ítem ${resolvedItemId} no existe en el catálogo. Revisión manual requerida.`;
        } else {
          const alreadyOwned = await prisma.userInventory.findUnique({
            where: { userId_itemId: { userId, itemId: resolvedItemId } },
          });

          if (alreadyOwned) {
            status = "auto_fixed";
            escalationReason = "";
            resolutionNote = `El ítem "${storeItem.nameEs}" ya se encontraba en tu inventario.`;
            autoFixApplied = `Ítem "${storeItem.nameEs}" ya estaba en inventario (confirmado)`;
          } else {
            try {
              await prisma.userInventory.create({
                data: {
                  userId,
                  itemId: resolvedItemId,
                  source: "support_grant",
                  acquiredAt: new Date(),
                },
              });
              status = "auto_fixed";
              escalationReason = "";
              resolutionNote = `Ítem "${storeItem.nameEs}" entregado a tu inventario.`;
              autoFixApplied = `Ítem "${storeItem.nameEs}" entregado al inventario`;
              afterState = JSON.stringify({
                streakCurrent: user.streakCurrent,
                devotionalsCompleted: user.devotionalsCompleted,
                grantedItem: resolvedItemId,
              });
              console.log(`[Support] Auto-granted item ${resolvedItemId} for ${userId}`);
            } catch {
              status = "needs_human";
              escalationReason = `Failed to grant item ${resolvedItemId} — possible constraint error`;
              resolutionNote = `No se pudo entregar el ítem automáticamente. Revisión manual requerida.`;
            }
          }
        }
      }
    } else if (type === "feedback") {
      status = "needs_human";
      escalationReason = "Feedback/sugerencia — requiere revisión del equipo";
      const fbTitle = (clientClaim.title as string) || "(sin título)";
      resolutionNote = `Feedback recibido: "${fbTitle}". En espera de respuesta del equipo.`;
    } else {
      // For audio/notification/reward_drop: always needs_human (info_only handled via botPreview)
      status = "needs_human";
      escalationReason = `${type} — no auto-fix available`;
      resolutionNote = `Problema tipo ${type} reportado. En espera de revisión de moderador.`;
    }

    snapshotComparison.escalationReason = escalationReason;

    const botPreview = buildBotPreview(
      type as TicketType,
      status,
      resolutionNote,
      claimedStreak,
      clientClaim as Record<string, unknown>,
      snapshotComparison
    );

    // Generate incident number
    const incidentNumber = await generateIncidentNumber();

    const ticket = await prisma.supportTicket.create({
      data: {
        incidentNumber,
        userId,
        type,
        claimedStreak,
        claimedDate,
        clientClaim: JSON.stringify(clientClaim),
        status,
        resolutionNote,
        beforeState,
        afterState,
        botPreview: JSON.stringify(botPreview),
        snapshotDate: snapshot?.snapshotDate ?? null,
        snapshotId: snapshot?.id ?? null,
      },
    });

    // ── Create initial timeline events ──────────────────────────────────────

    // 1. CREATED event with user's issue summary
    const typeLabels: Record<string, string> = {
      streak_missing: "Racha perdida",
      devotional_not_counted: "Devocional no contado",
      audio_tts: "Problema de audio/voz",
      notification: "Problema de notificación",
      reward_drop: "Regalo no recibido",
      purchase_not_delivered: "Compra / Ítem no entregado",
      feedback: "Comentario / Sugerencia",
    };
    let createdMsg = `${typeLabels[type] ?? type} reportado. ${botPreview.summary}`;
    const createdMeta: Record<string, unknown> = { type, claimedStreak, claimedDate };
    if (type === "feedback") {
      const fbTitle = (clientClaim.title as string) || "";
      const fbComment = (clientClaim.comment as string) || "";
      createdMsg = fbTitle
        ? `💬 "${fbTitle}"\n\n${fbComment}`
        : `💬 ${fbComment}`;
      createdMeta.feedbackTitle = fbTitle;
      createdMeta.feedbackComment = fbComment;
    }
    await addEvent(ticket.id, "USER", "CREATED", createdMsg, createdMeta);

    // 2. AUTO_FIX event (if applicable)
    if (autoFixApplied) {
      await addEvent(ticket.id, "SYSTEM", "AUTO_FIX",
        `✅ Corrección automática aplicada: ${autoFixApplied}`,
        { before: JSON.parse(beforeState), after: JSON.parse(afterState) }
      );
    }

    // 3. SYSTEM_REPLY with the user-facing message
    await addEvent(ticket.id, "SYSTEM", "SYSTEM_REPLY", botPreview.userMessageEs, {
      action: botPreview.action,
    });

    // 4. If status is auto_fixed or info_only, ask for rating
    if (status === "auto_fixed") {
      await addEvent(
        ticket.id,
        "SYSTEM",
        "STATUS_CHANGE",
        `Estado actualizado: tu incidente fue resuelto automáticamente. ¿Podemos cerrar este caso? Califícanos del 1 al 4 ⭐`,
        { newStatus: "auto_fixed" }
      );
    }

    // 5. For audio/notification info_only, set waiting_user and add REQUEST_INFO
    if (
      (type === "audio_tts" || type === "notification") &&
      botPreview.action === "info_only"
    ) {
      // Update status to waiting_user so user can reply
      await prisma.supportTicket.update({
        where: { id: ticket.id },
        data: { status: "waiting_user" },
      });

      await addEvent(
        ticket.id,
        "SYSTEM",
        "REQUEST_INFO",
        `Si después de seguir los pasos anteriores el problema persiste, puedes escribirnos aquí con:\n• Tu versión de iOS\n• Modelo de iPhone\n• Descripción detallada del problema\n\nTambién puedes enviarnos evidencia a: chaviticogames@gmail.com`,
        { supportEmail: "chaviticogames@gmail.com" }
      );

      return c.json({
        success: true,
        ticket: {
          id: ticket.id,
          incidentNumber,
          status: "waiting_user",
          resolutionNote: ticket.resolutionNote,
          autoFixed: false,
          botPreview,
          snapshotDate: ticket.snapshotDate,
        },
      });
    }

    return c.json({
      success: true,
      ticket: {
        id: ticket.id,
        incidentNumber,
        status: ticket.status,
        resolutionNote: ticket.resolutionNote,
        autoFixed: ticket.status === "auto_fixed",
        botPreview,
        snapshotDate: ticket.snapshotDate,
      },
    });
  }
);

// GET /api/support/tickets/:userId — user's own tickets (with event preview)
supportRouter.get("/tickets/:userId", async (c) => {
  const userId = c.req.param("userId");
  const tickets = await prisma.supportTicket.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 20,
    include: {
      events: {
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
  });

  const result = tickets.map((t) => ({
    id: t.id,
    incidentNumber: t.incidentNumber,
    type: t.type,
    status: t.status,
    rating: t.rating,
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
    latestEvent: t.events[0]
      ? {
          actor: t.events[0].actor,
          type: t.events[0].type,
          message: t.events[0].message,
          createdAt: t.events[0].createdAt.toISOString(),
        }
      : null,
  }));

  return c.json({ tickets: result });
});

// GET /api/support/ticket/:id — full ticket detail + events (user must own it)
supportRouter.get("/ticket/:id", async (c) => {
  const ticketId = c.req.param("id");
  const userId = c.req.header("X-User-Id");

  const ticket = await prisma.supportTicket.findUnique({
    where: { id: ticketId },
    include: {
      events: {
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!ticket) return c.json({ success: false, error: "Not found" }, 404);
  // Only owner or no userId check (admin uses different endpoint)
  if (userId && ticket.userId !== userId) {
    return c.json({ success: false, error: "Forbidden" }, 403);
  }

  let parsedBotPreview: BotPreview | null = null;
  try {
    parsedBotPreview = JSON.parse(ticket.botPreview || "{}") as BotPreview;
  } catch {}

  return c.json({
    ticket: {
      id: ticket.id,
      incidentNumber: ticket.incidentNumber,
      type: ticket.type,
      status: ticket.status,
      rating: ticket.rating,
      resolutionNote: ticket.resolutionNote,
      createdAt: ticket.createdAt.toISOString(),
      updatedAt: ticket.updatedAt.toISOString(),
      botPreview: parsedBotPreview,
      events: ticket.events.map((e) => ({
        id: e.id,
        actor: e.actor,
        type: e.type,
        message: e.message,
        meta: (() => { try { return JSON.parse(e.meta); } catch { return {}; } })(),
        createdAt: e.createdAt.toISOString(),
      })),
    },
  });
});

// POST /api/support/ticket/:id/reply — user reply
supportRouter.post(
  "/ticket/:id/reply",
  zValidator("json", z.object({
    userId: z.string().min(1),
    message: z.string().min(1).max(1000),
  })),
  async (c) => {
    const ticketId = c.req.param("id");
    const { userId, message } = c.req.valid("json");

    const ticket = await prisma.supportTicket.findUnique({
      where: { id: ticketId },
      select: { id: true, userId: true, status: true },
    });

    if (!ticket) return c.json({ success: false, error: "Not found" }, 404);
    if (ticket.userId !== userId) return c.json({ success: false, error: "Forbidden" }, 403);
    if (ticket.status === "closed") return c.json({ success: false, error: "Ticket is closed" }, 400);

    await addEvent(ticketId, "USER", "USER_REPLY", message);

    // Move from waiting_user to needs_human so admin sees the new info
    if (ticket.status === "waiting_user") {
      await prisma.supportTicket.update({
        where: { id: ticketId },
        data: { status: "needs_human" },
      });
      await addEvent(
        ticketId,
        "SYSTEM",
        "STATUS_CHANGE",
        "Tu mensaje fue recibido. Un moderador lo revisará pronto.",
        { newStatus: "needs_human" }
      );
    }

    return c.json({ success: true });
  }
);

// POST /api/support/ticket/:id/rate — user rating + close
supportRouter.post(
  "/ticket/:id/rate",
  zValidator("json", z.object({
    userId: z.string().min(1),
    rating: z.number().int().min(1).max(4),
  })),
  async (c) => {
    const ticketId = c.req.param("id");
    const { userId, rating } = c.req.valid("json");

    const ticket = await prisma.supportTicket.findUnique({
      where: { id: ticketId },
      select: { id: true, userId: true, status: true },
    });

    if (!ticket) return c.json({ success: false, error: "Not found" }, 404);
    if (ticket.userId !== userId) return c.json({ success: false, error: "Forbidden" }, 403);

    await prisma.supportTicket.update({
      where: { id: ticketId },
      data: { rating, status: "closed" },
    });

    const stars = "⭐".repeat(rating);
    await addEvent(ticketId, "USER", "RATING", `Calificación: ${stars} (${rating}/4)`, { rating });
    await addEvent(ticketId, "SYSTEM", "CLOSED", "Incidente cerrado. ¡Gracias por tu calificación!", { rating });

    return c.json({ success: true });
  }
);

// GET /api/support/admin/counts — lightweight pending counts for admin hub badges
supportRouter.get("/admin/counts", requireRole("MODERATOR"), async (c) => {
  const [openTickets, needsHumanTickets] = await Promise.all([
    prisma.supportTicket.count({ where: { status: "open" } }),
    prisma.supportTicket.count({ where: { status: "needs_human" } }),
  ]);
  return c.json({ pendingTickets: openTickets + needsHumanTickets });
});

// GET /api/support/admin/tickets — admin view with systemSnapshot enrichment
supportRouter.get("/admin/tickets", requireRole("MODERATOR"), async (c) => {
  const limit = Math.min(parseInt(c.req.query("limit") ?? "50"), 100);

  const tickets = await prisma.supportTicket.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true,
      incidentNumber: true,
      userId: true,
      type: true,
      claimedStreak: true,
      claimedDate: true,
      clientClaim: true,
      status: true,
      rating: true,
      resolutionNote: true,
      beforeState: true,
      afterState: true,
      botPreview: true,
      snapshotDate: true,
      snapshotId: true,
      createdAt: true,
      events: {
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
  });

  const today = getCRDateString(0);

  const enriched = await Promise.all(
    tickets.map(async (ticket) => {
      const user = await prisma.user.findUnique({
        where: { id: ticket.userId },
        select: {
          id: true,
          nickname: true,
          avatarId: true,
          countryCode: true,
          streakCurrent: true,
          dailyActions: true,
        },
      });

      let displaySnapshot: {
        id: string;
        snapshotDate: string;
        streak: number;
        lastDevotionalDateCompleted: string | null;
        totalDevotionalsCompleted: number;
      } | null = null;

      if (ticket.snapshotId) {
        displaySnapshot = await getSnapshotById(ticket.snapshotId);
      }
      if (!displaySnapshot) {
        const ticketDateCR = ticket.createdAt.toISOString().split("T")[0]!;
        displaySnapshot = await getBestSnapshotForUser(ticket.userId, ticketDateCR);
      }

      const todayCompletion = await prisma.devotionalCompletion.findFirst({
        where: { userId: ticket.userId, devotionalDate: today },
        select: { completedAt: true, devotionalDate: true },
      });

      const lastCompletion = await prisma.devotionalCompletion.findFirst({
        where: { userId: ticket.userId },
        orderBy: { completedAt: "desc" },
        select: { devotionalDate: true, completedAt: true },
      });

      const lastGift = await prisma.userGift.findFirst({
        where: { userId: ticket.userId },
        orderBy: { createdAt: "desc" },
        select: { giftDropId: true, createdAt: true },
      });

      let notificationsEnabled: boolean | undefined;
      let notificationsHour: number | undefined;
      try {
        const actions = JSON.parse(user?.dailyActions ?? "{}") as Record<string, unknown>;
        if (typeof actions.notificationsEnabled === "boolean") {
          notificationsEnabled = actions.notificationsEnabled;
        }
        if (typeof actions.notificationsHour === "number") {
          notificationsHour = actions.notificationsHour;
        }
      } catch { /* ignore */ }

      const systemSnapshot = {
        nickname: user?.nickname ?? ticket.userId.slice(0, 12),
        avatarId: user?.avatarId,
        country: user?.countryCode,
        currentStreak: user?.streakCurrent,
        linkedSnapshotId: displaySnapshot?.id ?? null,
        linkedSnapshotDate: displaySnapshot?.snapshotDate ?? null,
        linkedSnapshotStreak: displaySnapshot?.streak ?? null,
        linkedSnapshotDevDate: displaySnapshot?.lastDevotionalDateCompleted ?? null,
        lastSnapshotDate: displaySnapshot?.snapshotDate,
        lastSnapshotStreak: displaySnapshot?.streak,
        devotionalTodayExists: !!todayCompletion,
        devotionalLastClaimDate: lastCompletion?.devotionalDate ?? null,
        notificationsEnabled,
        notificationsHour,
        lastGiftDropId: lastGift?.giftDropId ?? null,
        lastGiftDropAt: lastGift?.createdAt?.toISOString() ?? null,
      };

      let parsedBotPreview: BotPreview | null = null;
      let parsedClientClaim: Record<string, unknown> = {};
      try {
        parsedBotPreview = JSON.parse(ticket.botPreview || "{}") as BotPreview;
      } catch {}
      try {
        parsedClientClaim = JSON.parse(ticket.clientClaim || "{}") as Record<string, unknown>;
      } catch {}

      if (!parsedBotPreview?.summary) {
        parsedBotPreview = buildBotPreview(
          ticket.type as TicketType,
          ticket.status as TicketStatus,
          ticket.resolutionNote ?? null,
          ticket.claimedStreak,
          parsedClientClaim
        );
      }

      if (parsedBotPreview && !parsedBotPreview.snapshotComparison && displaySnapshot) {
        parsedBotPreview.snapshotComparison = {
          snapshotDate: displaySnapshot.snapshotDate,
          snapshotId: displaySnapshot.id,
          snapshotStreak: displaySnapshot.streak,
          currentStreak: user?.streakCurrent ?? 0,
          claimedStreak: ticket.claimedStreak,
          diffDays: Math.abs(displaySnapshot.streak - ticket.claimedStreak),
          devotionalTodayCR: !!todayCompletion,
          lastDevotionalDate: displaySnapshot.lastDevotionalDateCompleted,
          escalationReason: ticket.resolutionNote ?? "",
        };
      }

      const latestEvent = ticket.events[0];

      return {
        ...ticket,
        clientClaim: parsedClientClaim,
        botPreview: parsedBotPreview,
        systemSnapshot,
        latestEvent: latestEvent
          ? {
              actor: latestEvent.actor,
              type: latestEvent.type,
              message: latestEvent.message,
              createdAt: latestEvent.createdAt.toISOString(),
            }
          : null,
      };
    })
  );

  return c.json({ tickets: enriched });
});

// GET /api/support/admin/ticket/:id/events — admin view of full timeline
supportRouter.get("/admin/ticket/:id/events", requireRole("MODERATOR"), async (c) => {
  const ticketId = c.req.param("id");
  const events = await prisma.supportTicketEvent.findMany({
    where: { ticketId },
    orderBy: { createdAt: "asc" },
  });

  return c.json({
    events: events.map((e) => ({
      id: e.id,
      actor: e.actor,
      type: e.type,
      message: e.message,
      meta: (() => { try { return JSON.parse(e.meta); } catch { return {}; } })(),
      createdAt: e.createdAt.toISOString(),
    })),
  });
});

// POST /api/support/admin/ticket/:id/reply — admin sends a message visible to user
supportRouter.post(
  "/admin/ticket/:id/reply",
  requireRole("MODERATOR"),
  zValidator(
    "json",
    z.object({ message: z.string().min(1).max(2000) })
  ),
  async (c) => {
    const ticketId = c.req.param("id");
    const { message } = c.req.valid("json");
    const adminUserId = c.req.header("X-User-Id") ?? "unknown";

    const ticket = await prisma.supportTicket.findUnique({
      where: { id: ticketId },
      select: { id: true, status: true },
    });
    if (!ticket) return c.json({ success: false, error: "Ticket not found" }, 404);

    // Add the admin reply event
    await addEvent(ticketId, "ADMIN", "ADMIN_REPLY", message, { adminUserId });

    // If ticket is needs_human, transition to waiting_user so user knows to respond
    if (ticket.status === "needs_human" || ticket.status === "open") {
      await prisma.supportTicket.update({
        where: { id: ticketId },
        data: { status: "waiting_user" },
      });
      await addEvent(ticketId, "SYSTEM", "STATUS_CHANGE",
        "El moderador respondió. Por favor revisa la respuesta y responde si tienes más información.",
        { from: ticket.status, to: "waiting_user" }
      );
    }

    return c.json({ success: true });
  }
);

// POST /api/support/admin/compensate
supportRouter.post(
  "/admin/compensate",
  requireRole("MODERATOR"),
  zValidator(
    "json",
    z.object({
      ticketId: z.string().min(1),
      targetUserId: z.string().min(1),
      title: z.string().min(1),
      message: z.string().min(1),
      rewardType: z.enum(["CHEST", "THEME", "TITLE", "AVATAR", "ITEM"]),
      rewardId: z.string().min(1),
    })
  ),
  async (c) => {
    const { ticketId, targetUserId, title, message, rewardType, rewardId } =
      c.req.valid("json");
    const adminUserId = c.req.header("X-User-Id") ?? "unknown";

    const target = await prisma.user.findUnique({
      where: { id: targetUserId },
      select: { id: true },
    });
    if (!target) {
      return c.json({ success: false, error: "Target user not found" }, 404);
    }

    const giftDrop = await prisma.giftDrop.create({
      data: {
        title,
        message,
        rewardType,
        rewardId,
        audienceType: "USER_IDS",
        audienceUserIds: JSON.stringify([targetUserId]),
        isActive: true,
      },
    });

    await prisma.userGift.create({
      data: { userId: targetUserId, giftDropId: giftDrop.id, status: "PENDING" },
    });

    await prisma.supportTicket.update({
      where: { id: ticketId },
      data: {
        status: "closed",
        resolutionNote: `Compensado con regalo ${giftDrop.id} por admin ${adminUserId}`,
      },
    });

    // Timeline events
    await addEvent(ticketId, "ADMIN", "COMPENSATION",
      `🎁 Compensación enviada: ${title} (${rewardType})\n${message}`,
      { giftDropId: giftDrop.id, rewardType, rewardId, adminUserId }
    );
    await addEvent(
      ticketId,
      "SYSTEM",
      "CLOSED",
      `¿Podemos cerrar este incidente? Califícanos del 1 al 4 ⭐ para ayudarnos a mejorar.`,
      { reason: "compensated" }
    );

    console.log(`[Support] Compensate: admin ${adminUserId} → gift ${giftDrop.id} for ${targetUserId} (ticket ${ticketId})`);
    return c.json({ success: true, giftDropId: giftDrop.id });
  }
);

// PATCH /api/support/admin/tickets/:id/resolve — manually resolve or reject a ticket
supportRouter.patch(
  "/admin/tickets/:id/resolve",
  requireRole("MODERATOR"),
  zValidator(
    "json",
    z.object({
      resolution: z.enum(["resolved", "rejected"]),
      note: z.string().max(500).optional(),
      applyStreak: z.number().int().min(0).optional(),
      // Admin reply message visible to user
      adminMessage: z.string().max(1000).optional(),
    })
  ),
  async (c) => {
    const ticketId = c.req.param("id");
    const { resolution, note, applyStreak, adminMessage } = c.req.valid("json");
    const adminUserId = c.req.header("X-User-Id") ?? "unknown";

    const ticket = await prisma.supportTicket.findUnique({
      where: { id: ticketId },
      select: { id: true, status: true, userId: true, type: true, snapshotId: true, claimedStreak: true, claimedDate: true },
    });
    if (!ticket) return c.json({ success: false, error: "Ticket not found" }, 404);
    if (ticket.status === "closed") return c.json({ success: false, error: "Ticket already closed" }, 400);

    let appliedChange: string | null = null;

    if (resolution === "resolved") {
      if (
        (ticket.type === "streak_missing") &&
        applyStreak !== undefined &&
        applyStreak > 0
      ) {
        const user = await prisma.user.findUnique({
          where: { id: ticket.userId },
          select: { streakCurrent: true, streakBest: true },
        });
        if (user) {
          const safeStreak = Math.max(applyStreak, user.streakCurrent);
          const newBest = Math.max(safeStreak, user.streakBest);
          await prisma.user.update({
            where: { id: ticket.userId },
            data: { streakCurrent: safeStreak, streakBest: newBest },
          });
          appliedChange = `Racha corregida manualmente: ${user.streakCurrent}→${safeStreak}`;
          console.log(`[Support] Manual streak fix for ${ticket.userId}: ${user.streakCurrent}→${safeStreak}`);
        }
      }

      if (ticket.type === "devotional_not_counted" && ticket.claimedDate) {
        const existing = await prisma.devotionalCompletion.findFirst({
          where: { userId: ticket.userId, devotionalDate: ticket.claimedDate },
        });
        if (!existing) {
          await prisma.devotionalCompletion.upsert({
            where: { userId_devotionalDate: { userId: ticket.userId, devotionalDate: ticket.claimedDate } },
            create: { userId: ticket.userId, devotionalDate: ticket.claimedDate, completedAt: new Date() },
            update: {},
          });
          appliedChange = `Devocional del ${ticket.claimedDate} registrado manualmente`;
          console.log(`[Support] Manual devotional fix for ${ticket.userId} on ${ticket.claimedDate}`);
        } else {
          appliedChange = `Devocional del ${ticket.claimedDate} ya existía`;
        }
      }
    }

    const resolutionNote =
      resolution === "resolved"
        ? `Resuelto manualmente por admin ${adminUserId}${appliedChange ? ". " + appliedChange : ""}${note ? ". Nota: " + note : ""}`
        : `Rechazado por admin ${adminUserId}${note ? ". Motivo: " + note : ""}`;

    await prisma.supportTicket.update({
      where: { id: ticketId },
      data: { status: "closed", resolutionNote },
    });

    // Timeline events visible to user
    if (appliedChange) {
      await addEvent(ticketId, "ADMIN", "AUTO_FIX",
        `✅ Corrección aplicada por el equipo: ${appliedChange}`,
        { adminUserId }
      );
    }

    const userMsg = adminMessage
      || (resolution === "resolved"
        ? `Tu caso fue revisado y resuelto por nuestro equipo. ${appliedChange ? appliedChange + "." : ""} ${note ? note : ""}`.trim()
        : `Tu caso fue revisado. ${note ? "Motivo: " + note : "No fue posible aplicar una corrección en este caso."}`.trim());

    await addEvent(ticketId, "ADMIN", "ADMIN_REPLY", userMsg, { adminUserId, resolution });
    await addEvent(
      ticketId,
      "SYSTEM",
      "CLOSED",
      `¿Podemos cerrar este incidente? Califícanos del 1 al 4 ⭐`,
      { reason: resolution }
    );

    console.log(`[Support] Ticket ${ticketId} ${resolution} by admin ${adminUserId}`);
    return c.json({ success: true, appliedChange });
  }
);

export { supportRouter };
 
