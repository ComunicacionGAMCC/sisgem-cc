import { and, asc, desc, eq, sql } from "drizzle-orm";
import { getDb } from "./index";
import {
  rrhhCargos,
  rrhhDescuentos,
  rrhhMovimientosCargo,
  rrhhPersonal,
  rrhhPlanillaItems,
  rrhhPlanillas,
  unidades,
} from "./schema";

export type RrhhAuditActor = { id: string; name: string };

export async function obtenerPanelRecursosHumanos() {
  const db = getDb();
  const [positions, staff, movements, payrolls, payrollItems, discounts] = await Promise.all([
    db.select({
      id: rrhhCargos.id,
      code: rrhhCargos.codigo,
      name: rrhhCargos.nombre,
      employmentType: rrhhCargos.tipoVinculacion,
      baseSalary: rrhhCargos.haberBasico,
      active: rrhhCargos.activo,
      unitId: unidades.id,
      unitName: unidades.nombre,
    }).from(rrhhCargos).innerJoin(unidades, eq(unidades.id, rrhhCargos.unidadId)).orderBy(asc(unidades.nombre), asc(rrhhCargos.nombre)),
    db.select({
      id: rrhhPersonal.id,
      document: rrhhPersonal.documento,
      firstNames: rrhhPersonal.nombres,
      lastNames: rrhhPersonal.apellidos,
      positionId: rrhhPersonal.cargoId,
      position: rrhhCargos.nombre,
      unit: unidades.nombre,
      employmentType: rrhhPersonal.tipoVinculacion,
      startDate: rrhhPersonal.fechaIngreso,
      contractEndDate: rrhhPersonal.fechaFinContrato,
      email: rrhhPersonal.email,
      phone: rrhhPersonal.telefono,
      active: rrhhPersonal.activo,
    }).from(rrhhPersonal)
      .innerJoin(rrhhCargos, eq(rrhhCargos.id, rrhhPersonal.cargoId))
      .innerJoin(unidades, eq(unidades.id, rrhhCargos.unidadId))
      .orderBy(desc(rrhhPersonal.activo), asc(rrhhPersonal.apellidos), asc(rrhhPersonal.nombres)),
    db.select().from(rrhhMovimientosCargo).orderBy(desc(rrhhMovimientosCargo.fechaEfectiva), desc(rrhhMovimientosCargo.createdAt)).limit(50),
    db.select().from(rrhhPlanillas).orderBy(desc(rrhhPlanillas.gestion), desc(rrhhPlanillas.mes)).limit(18),
    db.select({
      id: rrhhPlanillaItems.id,
      payrollId: rrhhPlanillaItems.planillaId,
      staffId: rrhhPlanillaItems.personalId,
      firstNames: rrhhPersonal.nombres,
      lastNames: rrhhPersonal.apellidos,
      position: rrhhCargos.nombre,
      baseSalary: rrhhPlanillaItems.haberBasico,
      bonuses: rrhhPlanillaItems.bonos,
      grossPay: rrhhPlanillaItems.totalGanado,
      deductions: rrhhPlanillaItems.totalDescuentos,
      netPay: rrhhPlanillaItems.liquidoPagable,
      observations: rrhhPlanillaItems.observaciones,
    }).from(rrhhPlanillaItems)
      .innerJoin(rrhhPersonal, eq(rrhhPersonal.id, rrhhPlanillaItems.personalId))
      .innerJoin(rrhhCargos, eq(rrhhCargos.id, rrhhPersonal.cargoId))
      .orderBy(asc(rrhhPersonal.apellidos), asc(rrhhPersonal.nombres)),
    db.select().from(rrhhDescuentos).orderBy(desc(rrhhDescuentos.createdAt)),
  ]);

  return { positions, staff, movements, payrolls, payrollItems, discounts };
}

export async function crearCargoRrhh(input: {
  code: string; unitId: string; name: string; employmentType: string; baseSalary: string;
}) {
  const [item] = await getDb().insert(rrhhCargos).values({
    codigo: input.code,
    unidadId: input.unitId,
    nombre: input.name,
    tipoVinculacion: input.employmentType,
    haberBasico: input.baseSalary,
  }).returning();
  return item;
}

export async function actualizarCargoRrhh(input: {
  id: number; name: string; unitId: string; employmentType: string; baseSalary: string; active: boolean;
}) {
  const [item] = await getDb().update(rrhhCargos).set({
    nombre: input.name,
    unidadId: input.unitId,
    tipoVinculacion: input.employmentType,
    haberBasico: input.baseSalary,
    activo: input.active,
    updatedAt: new Date(),
  }).where(eq(rrhhCargos.id, input.id)).returning();
  return item;
}

export async function crearPersonalRrhh(input: {
  document: string; firstNames: string; lastNames: string; positionId: number;
  employmentType: string; startDate: string; contractEndDate: string | null;
  email: string | null; phone: string | null;
}) {
  const [item] = await getDb().insert(rrhhPersonal).values({
    documento: input.document,
    nombres: input.firstNames,
    apellidos: input.lastNames,
    cargoId: input.positionId,
    tipoVinculacion: input.employmentType,
    fechaIngreso: input.startDate,
    fechaFinContrato: input.contractEndDate,
    email: input.email,
    telefono: input.phone,
  }).returning();
  return item;
}

export async function moverPersonalRrhh(input: {
  staffId: number; positionId: number; reason: string; effectiveDate: string; actor: RrhhAuditActor;
}) {
  return getDb().transaction(async (tx) => {
    const [current] = await tx.select({ positionId: rrhhPersonal.cargoId }).from(rrhhPersonal).where(eq(rrhhPersonal.id, input.staffId)).limit(1);
    if (!current) throw new Error("El servidor público seleccionado no existe.");
    await tx.insert(rrhhMovimientosCargo).values({
      personalId: input.staffId,
      cargoAnteriorId: current.positionId,
      cargoNuevoId: input.positionId,
      motivo: input.reason,
      fechaEfectiva: input.effectiveDate,
      registradoPorUsuarioId: input.actor.id,
      registradoPorNombre: input.actor.name,
    });
    const [updated] = await tx.update(rrhhPersonal).set({ cargoId: input.positionId, updatedAt: new Date() })
      .where(eq(rrhhPersonal.id, input.staffId)).returning();
    return updated;
  });
}

export async function cambiarEstadoPersonalRrhh(staffId: number, active: boolean) {
  const [item] = await getDb().update(rrhhPersonal).set({ activo: active, updatedAt: new Date() })
    .where(eq(rrhhPersonal.id, staffId)).returning();
  return item;
}

export async function crearPlanillaRrhh(year: number, month: number, actor: RrhhAuditActor) {
  return getDb().transaction(async (tx) => {
    const [payroll] = await tx.insert(rrhhPlanillas).values({
      gestion: year,
      mes: month,
      creadoPorUsuarioId: actor.id,
      creadoPorNombre: actor.name,
    }).returning();
    const activeStaff = await tx.select({
      staffId: rrhhPersonal.id,
      baseSalary: rrhhCargos.haberBasico,
    }).from(rrhhPersonal).innerJoin(rrhhCargos, eq(rrhhCargos.id, rrhhPersonal.cargoId))
      .where(and(eq(rrhhPersonal.activo, true), eq(rrhhCargos.activo, true)));
    if (activeStaff.length) {
      await tx.insert(rrhhPlanillaItems).values(activeStaff.map((staff) => ({
        planillaId: payroll.id,
        personalId: staff.staffId,
        haberBasico: staff.baseSalary,
        totalGanado: staff.baseSalary,
        liquidoPagable: staff.baseSalary,
      })));
    }
    await tx.update(rrhhPlanillas).set({
      totalGanado: sql`coalesce((select sum(total_ganado) from rrhh_planilla_items where planilla_id = ${payroll.id}), 0)`,
      totalDescuentos: sql`coalesce((select sum(total_descuentos) from rrhh_planilla_items where planilla_id = ${payroll.id}), 0)`,
      totalLiquido: sql`coalesce((select sum(liquido_pagable) from rrhh_planilla_items where planilla_id = ${payroll.id}), 0)`,
      updatedAt: new Date(),
    }).where(eq(rrhhPlanillas.id, payroll.id));
    return payroll;
  });
}

export async function registrarDescuentoRrhh(input: {
  payrollItemId: number; type: string; concept: string; amount: string;
}) {
  return getDb().transaction(async (tx) => {
    const [line] = await tx.select({ payrollId: rrhhPlanillaItems.planillaId })
      .from(rrhhPlanillaItems).where(eq(rrhhPlanillaItems.id, input.payrollItemId)).limit(1);
    if (!line) throw new Error("La fila de planilla seleccionada no existe.");
    const [discount] = await tx.insert(rrhhDescuentos).values({
      planillaItemId: input.payrollItemId,
      tipo: input.type,
      concepto: input.concept,
      monto: input.amount,
    }).returning();
    await tx.update(rrhhPlanillaItems).set({
      totalDescuentos: sql`${rrhhPlanillaItems.totalDescuentos} + ${input.amount}`,
      liquidoPagable: sql`greatest(${rrhhPlanillaItems.totalGanado} - (${rrhhPlanillaItems.totalDescuentos} + ${input.amount}), 0)`,
      updatedAt: new Date(),
    }).where(eq(rrhhPlanillaItems.id, input.payrollItemId));
    await tx.update(rrhhPlanillas).set({
      totalGanado: sql`coalesce((select sum(total_ganado) from rrhh_planilla_items where planilla_id = ${line.payrollId}), 0)`,
      totalDescuentos: sql`coalesce((select sum(total_descuentos) from rrhh_planilla_items where planilla_id = ${line.payrollId}), 0)`,
      totalLiquido: sql`coalesce((select sum(liquido_pagable) from rrhh_planilla_items where planilla_id = ${line.payrollId}), 0)`,
      updatedAt: new Date(),
    }).where(eq(rrhhPlanillas.id, line.payrollId));
    return discount;
  });
}
