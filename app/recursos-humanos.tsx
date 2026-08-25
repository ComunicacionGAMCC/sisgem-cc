"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useAccess } from "./access";

type Position = { id: number; code: string; name: string; employmentType: string; baseSalary: string; active: boolean; unitId: string; unitName: string };
type Staff = { id: number; document: string; firstNames: string; lastNames: string; positionId: number; position: string; unit: string; employmentType: string; startDate: string; contractEndDate: string | null; email: string | null; phone: string | null; active: boolean };
type Payroll = { id: number; gestion: number; mes: number; estado: string; totalGanado: string; totalDescuentos: string; totalLiquido: string };
type PayrollItem = { id: number; payrollId: number; staffId: number; firstNames: string; lastNames: string; position: string; baseSalary: string; bonuses: string; grossPay: string; deductions: string; netPay: string };
type HrData = { positions: Position[]; staff: Staff[]; payrolls: Payroll[]; payrollItems: PayrollItem[]; discounts: Array<{ id: number; planillaItemId: number; concepto: string; tipo: string; monto: string }> };

const employmentLabels: Record<string, string> = {
  planta: "Personal de planta",
  consultor_linea: "Consultor individual de línea",
  contrato: "Personal de contrato",
};
const monthNames = ["", "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

function bolivianos(value: string | number) {
  return new Intl.NumberFormat("es-BO", { style: "currency", currency: "BOB", maximumFractionDigits: 2 }).format(Number(value) || 0);
}

export function HumanResourcesModule() {
  const access = useAccess();
  const [data, setData] = useState<HrData | null>(null);
  const [tab, setTab] = useState<"staff" | "positions" | "payroll">("staff");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [refresh, setRefresh] = useState(0);
  const [editingPosition, setEditingPosition] = useState<Position | null>(null);
  const [movingStaff, setMovingStaff] = useState<Staff | null>(null);
  const [selectedPayrollId, setSelectedPayrollId] = useState(0);
  const [discountLine, setDiscountLine] = useState<PayrollItem | null>(null);
  const canManage = access.hasPermission("sigem.hr.manage");
  const canPayroll = access.hasPermission("sigem.hr.payroll");

  useEffect(() => {
    const token = access.session?.access_token;
    if (!token) return;
    const controller = new AbortController();
    fetch("/api/recursos-humanos", { cache: "no-store", signal: controller.signal, headers: { Authorization: `Bearer ${token}` } })
      .then(async (response) => {
        const result = (await response.json()) as HrData & { error?: string };
        if (!response.ok) throw new Error(result.error || "No se pudo cargar Recursos Humanos.");
        setData(result);
        setSelectedPayrollId((current) => current || result.payrolls[0]?.id || 0);
      })
      .catch((error) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setMessage(error instanceof Error ? error.message : "No se pudo cargar Recursos Humanos.");
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [access.session?.access_token, refresh]);

  const activeStaff = data?.staff.filter((item) => item.active) ?? [];
  const contractStaff = activeStaff.filter((item) => item.employmentType !== "planta");
  const selectedPayroll = data?.payrolls.find((item) => item.id === selectedPayrollId) ?? data?.payrolls[0];
  const currentPayrollItems = data?.payrollItems.filter((item) => item.payrollId === selectedPayroll?.id) ?? [];
  const units = useMemo(() => {
    const map = new Map<string, string>();
    data?.positions.forEach((position) => map.set(position.unitId, position.unitName));
    return [...map.entries()].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name, "es"));
  }, [data?.positions]);

  async function action(payload: Record<string, unknown>) {
    const token = access.session?.access_token;
    if (!token) return false;
    setMessage("");
    const response = await fetch("/api/recursos-humanos", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const result = (await response.json()) as { error?: string };
    if (!response.ok) {
      setMessage(result.error || "No se pudo completar la operación.");
      return false;
    }
    setRefresh((value) => value + 1);
    return true;
  }

  async function createStaff(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const position = data?.positions.find((item) => item.id === Number(form.get("positionId")));
    const ok = await action({
      action: "create_staff", document: form.get("document"), firstNames: form.get("firstNames"), lastNames: form.get("lastNames"),
      positionId: form.get("positionId"), employmentType: position?.employmentType, startDate: form.get("startDate"),
      contractEndDate: form.get("contractEndDate"), email: form.get("email"), phone: form.get("phone"),
    });
    if (ok) { event.currentTarget.reset(); setMessage("Personal registrado correctamente."); }
  }

  async function savePosition(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const ok = await action({
      action: editingPosition ? "update_position" : "create_position",
      id: editingPosition?.id, code: form.get("code"), name: form.get("name"), unitId: form.get("unitId"),
      employmentType: form.get("employmentType"), baseSalary: form.get("baseSalary"), active: form.get("active") !== "false",
    });
    if (ok) { event.currentTarget.reset(); setEditingPosition(null); setMessage(editingPosition ? "Cargo actualizado." : "Cargo contractual creado."); }
  }

  async function moveStaff(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!movingStaff) return;
    const form = new FormData(event.currentTarget);
    const ok = await action({ action: "move_staff", staffId: movingStaff.id, positionId: form.get("positionId"), effectiveDate: form.get("effectiveDate"), reason: form.get("reason") });
    if (ok) { setMovingStaff(null); setMessage("Cambio de cargo registrado con historial."); }
  }

  async function createPayroll(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const ok = await action({ action: "create_payroll", year: form.get("year"), month: form.get("month") });
    if (ok) { event.currentTarget.reset(); setMessage("Planilla mensual generada con el personal activo."); }
  }

  async function addDiscount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!discountLine) return;
    const form = new FormData(event.currentTarget);
    const ok = await action({ action: "add_discount", payrollItemId: discountLine.id, type: form.get("type"), concept: form.get("concept"), amount: form.get("amount") });
    if (ok) { setDiscountLine(null); setMessage("Descuento registrado y líquido pagable recalculado."); }
  }

  if (loading && !data) return <section className="hrState">Cargando planilla institucional…</section>;
  if (!data) return <section className="hrState error">{message || "No se pudo cargar Recursos Humanos."}</section>;

  return (
    <section className="hrModule moduleView">
      <div className="hrHero"><div><span>RECURSOS HUMANOS · GAMCC</span><h2>Personal, cargos y planillas</h2><p>Administración laboral centralizada con historial de movimientos y control salarial protegido.</p></div><div className="hrHeroBadge"><b>{activeStaff.length}</b><span>personas activas<small>{contractStaff.length} contratos o consultorías</small></span></div></div>
      <div className="hrStats"><article><span>Personal activo</span><strong>{activeStaff.length}</strong><small>Planta y contratos</small></article><article><span>Cargos habilitados</span><strong>{data.positions.filter((item) => item.active).length}</strong><small>Catálogo institucional</small></article><article><span>Contratos vigentes</span><strong>{contractStaff.length}</strong><small>Consultores y eventuales</small></article><article><span>Última planilla</span><strong>{selectedPayroll ? `${monthNames[selectedPayroll.mes]} ${selectedPayroll.gestion}` : "—"}</strong><small>{selectedPayroll?.estado || "Sin generar"}</small></article></div>
      <nav className="hrTabs"><button className={tab === "staff" ? "active" : ""} onClick={() => setTab("staff")}>Planilla de personal</button><button className={tab === "positions" ? "active" : ""} onClick={() => setTab("positions")}>Cargos y contratos</button><button className={tab === "payroll" ? "active" : ""} onClick={() => setTab("payroll")}>Sueldos y salarios</button></nav>
      {message && <p className="hrMessage" role="status">{message}</p>}

      {tab === "staff" && <div className="hrTwoColumns">
        <section className="panel hrTablePanel"><header><div><span>PERSONAL DEL GAMCC</span><h3>Planilla institucional</h3></div><em>{data.staff.length} registros</em></header><div className="hrTable"><div className="hrRow header"><span>Servidor público</span><span>Cargo y área</span><span>Vínculo</span><span>Estado</span><span /></div>{data.staff.map((item) => <div className="hrRow" key={item.id}><span><strong>{item.firstNames} {item.lastNames}</strong><small>CI {item.document}</small></span><span><strong>{item.position}</strong><small>{item.unit}</small></span><span><i>{employmentLabels[item.employmentType]}</i><small>{item.contractEndDate ? `Hasta ${item.contractEndDate}` : `Desde ${item.startDate}`}</small></span><span><b className={item.active ? "statusOn" : "statusOff"}>{item.active ? "Activo" : "Inactivo"}</b></span><span>{canManage && <><button onClick={() => setMovingStaff(item)}>Cambiar cargo</button><button onClick={() => void action({ action: "set_staff_active", staffId: item.id, active: !item.active })}>{item.active ? "Dar de baja" : "Reactivar"}</button></>}</span></div>)}</div></section>
        {canManage && <section className="panel hrFormPanel"><header><span>NUEVO REGISTRO</span><h3>Incorporar personal</h3></header><form onSubmit={createStaff}><div className="formGrid"><label>Nombres<input name="firstNames" required /></label><label>Apellidos<input name="lastNames" required /></label><label>Cédula de identidad<input name="document" required /></label><label>Fecha de ingreso<input name="startDate" type="date" required /></label></div><label>Cargo<select name="positionId" required defaultValue=""><option value="" disabled>Seleccionar cargo</option>{data.positions.filter((item) => item.active).map((item) => <option key={item.id} value={item.id}>{item.name} · {item.unitName}</option>)}</select></label><div className="formGrid"><label>Fin de contrato<input name="contractEndDate" type="date" /></label><label>Teléfono<input name="phone" /></label></div><label>Correo institucional<input name="email" type="email" /></label><button className="primaryAction">Registrar personal</button></form></section>}
      </div>}

      {tab === "positions" && <div className="hrTwoColumns">
        <section className="panel hrTablePanel"><header><div><span>ESTRUCTURA LABORAL</span><h3>Cargos de planta y contractuales</h3></div></header><div className="hrPositionList">{data.positions.map((item) => <article key={item.id}><div><strong>{item.name}</strong><small>{item.code} · {item.unitName}</small></div><span>{employmentLabels[item.employmentType]}</span><b>{bolivianos(item.baseSalary)}</b>{canManage && <button onClick={() => setEditingPosition(item)}>Editar</button>}</article>)}</div></section>
        {canManage && <section className="panel hrFormPanel"><header><span>{editingPosition ? "EDITAR CARGO" : "NUEVO CARGO"}</span><h3>{editingPosition ? editingPosition.name : "Contrato o consultoría"}</h3></header><form key={editingPosition?.id ?? "new"} onSubmit={savePosition}><label>Código<input name="code" defaultValue={editingPosition?.code} disabled={Boolean(editingPosition)} required /></label><label>Nombre del cargo<input name="name" defaultValue={editingPosition?.name} required /></label><label>Área<select name="unitId" defaultValue={editingPosition?.unitId} required>{units.map((unit) => <option key={unit.id} value={unit.id}>{unit.name}</option>)}</select></label><label>Tipo de vínculo<select name="employmentType" defaultValue={editingPosition?.employmentType || "consultor_linea"}><option value="planta">Personal de planta</option><option value="consultor_linea">Consultor individual de línea</option><option value="contrato">Personal de contrato</option></select></label><label>Haber básico mensual<input name="baseSalary" type="number" min="0" step="0.01" defaultValue={editingPosition?.baseSalary || "0"} required /></label>{editingPosition && <label>Estado<select name="active" defaultValue={String(editingPosition.active)}><option value="true">Activo</option><option value="false">Desactivado</option></select></label>}<div className="hrFormActions">{editingPosition && <button type="button" onClick={() => setEditingPosition(null)}>Cancelar</button>}<button className="primaryAction">{editingPosition ? "Guardar cambios" : "Crear cargo"}</button></div></form></section>}
      </div>}

      {tab === "payroll" && <div className="hrPayrollLayout">
        <section className="panel hrPayrollSummary"><header><div><span>PLANILLA SALARIAL</span><h3>Sueldos, salarios y descuentos</h3></div>{data.payrolls.length > 0 && <select value={selectedPayroll?.id || 0} onChange={(event) => setSelectedPayrollId(Number(event.target.value))}>{data.payrolls.map((item) => <option value={item.id} key={item.id}>{monthNames[item.mes]} {item.gestion}</option>)}</select>}</header>{selectedPayroll ? <div className="payrollTotals"><article><span>Total ganado</span><strong>{bolivianos(selectedPayroll.totalGanado)}</strong></article><article><span>Descuentos</span><strong>{bolivianos(selectedPayroll.totalDescuentos)}</strong></article><article><span>Líquido pagable</span><strong>{bolivianos(selectedPayroll.totalLiquido)}</strong></article></div> : <p className="hrEmpty">Todavía no se generó una planilla.</p>}<div className="hrTable payroll"><div className="payrollRow header"><span>Personal</span><span>Haber básico</span><span>Descuentos</span><span>Líquido</span><span /></div>{currentPayrollItems.map((item) => <div className="payrollRow" key={item.id}><span><strong>{item.firstNames} {item.lastNames}</strong><small>{item.position}</small></span><span>{bolivianos(item.baseSalary)}</span><span className="deduction">− {bolivianos(item.deductions)}</span><span className="netPay">{bolivianos(item.netPay)}</span><span>{canPayroll && <button onClick={() => setDiscountLine(item)}>Registrar descuento</button>}</span></div>)}</div></section>
        {canPayroll && <section className="panel hrGeneratePanel"><header><span>NUEVO PERIODO</span><h3>Generar planilla</h3></header><form onSubmit={createPayroll}><label>Gestión<input name="year" type="number" min="2020" max="2100" defaultValue={new Date().getFullYear()} required /></label><label>Mes<select name="month" defaultValue={new Date().getMonth() + 1}>{monthNames.slice(1).map((name, index) => <option key={name} value={index + 1}>{name}</option>)}</select></label><p>Se incluirá automáticamente a todo el personal activo con el haber básico vigente de su cargo.</p><button className="primaryAction">Generar planilla mensual</button></form></section>}
      </div>}

      {movingStaff && <div className="modalBackdrop"><form className="routeModal hrModal" onSubmit={moveStaff}><header className="modalHeader"><div><span>MOVIMIENTO DE PERSONAL</span><h2>Reemplazar o cambiar cargo</h2></div><button type="button" onClick={() => setMovingStaff(null)}>×</button></header><p><b>{movingStaff.firstNames} {movingStaff.lastNames}</b><br />Cargo actual: {movingStaff.position}</p><label>Nuevo cargo<select name="positionId" required defaultValue=""><option value="" disabled>Seleccionar cargo</option>{data.positions.filter((item) => item.active && item.id !== movingStaff.positionId).map((item) => <option value={item.id} key={item.id}>{item.name} · {item.unitName}</option>)}</select></label><label>Fecha efectiva<input name="effectiveDate" type="date" required /></label><label>Motivo<textarea name="reason" rows={3} required minLength={5} /></label><footer className="modalActions"><button type="button" onClick={() => setMovingStaff(null)}>Cancelar</button><button className="primaryAction">Registrar movimiento</button></footer></form></div>}
      {discountLine && <div className="modalBackdrop"><form className="routeModal hrModal" onSubmit={addDiscount}><header className="modalHeader"><div><span>DESCUENTO DE PLANILLA</span><h2>{discountLine.firstNames} {discountLine.lastNames}</h2></div><button type="button" onClick={() => setDiscountLine(null)}>×</button></header><label>Tipo<select name="type"><option value="afp">Aporte AFP</option><option value="rc_iva">RC-IVA</option><option value="anticipo">Anticipo</option><option value="falta">Falta o sanción</option><option value="otro">Otro descuento</option></select></label><label>Concepto<input name="concept" required minLength={3} /></label><label>Monto (Bs)<input name="amount" type="number" min="0.01" step="0.01" required /></label><footer className="modalActions"><button type="button" onClick={() => setDiscountLine(null)}>Cancelar</button><button className="primaryAction">Aplicar descuento</button></footer></form></div>}
    </section>
  );
}
