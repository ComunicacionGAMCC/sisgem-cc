"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { getMunicipalIsoDate } from "../lib/municipal-date";
import { useAccess } from "./access";

type ProcurementItem = {
  id: string; code: string; object: string; modality: string; status: string; amount: string;
  unitId: string; unit: string; responsible: string | null; startDate: string; deadline: string | null;
};
type Unit = { id: string; code: string; name: string };
type ProcurementData = { items: ProcurementItem[]; units: Unit[] };

const statusLabels: Record<string, string> = {
  preparacion: "Preparación", certificacion: "Certificación", convocatoria: "Convocatoria",
  evaluacion: "Evaluación", adjudicado: "Adjudicado", contrato: "Contrato",
  ejecucion: "Ejecución", pago: "Pago", concluido: "Concluido", cancelado: "Cancelado",
};
const modalityLabels: Record<string, string> = {
  menor: "Contratación menor", anpe: "ANPE", licitacion_publica: "Licitación pública",
  directa: "Contratación directa", excepcion: "Por excepción",
};

function money(value: string) {
  return new Intl.NumberFormat("es-BO", { style: "currency", currency: "BOB", maximumFractionDigits: 2 }).format(Number(value));
}

export function ProcurementModule() {
  const access = useAccess();
  const canCreate = access.hasPermission("sigem.routes.create");
  const canUpdate = access.hasPermission("sigem.routes.update");
  const accessToken = access.session?.access_token;
  const [data, setData] = useState<ProcurementData>({ items: [], units: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [modal, setModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    try {
      const response = await fetch("/api/contrataciones", { headers: { Authorization: `Bearer ${accessToken}` }, cache: "no-store" });
      const result = (await response.json()) as ProcurementData & { error?: string };
      if (!response.ok) throw new Error(result.error || "No se pudieron consultar las contrataciones.");
      setData(result);
      setError("");
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "No se pudieron consultar las contrataciones.");
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    const task = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(task);
  }, [load]);

  const filtered = useMemo(() => {
    const term = search.trim().toLocaleLowerCase("es");
    return term ? data.items.filter((item) => `${item.code} ${item.object} ${item.unit}`.toLocaleLowerCase("es").includes(term)) : data.items;
  }, [data.items, search]);
  const active = data.items.filter((item) => !["concluido", "cancelado"].includes(item.status));
  const amountActive = active.reduce((total, item) => total + Number(item.amount), 0);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!accessToken) return;
    setSaving(true);
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/contrataciones", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ action: "create", object: form.get("object"), modality: form.get("modality"), amount: form.get("amount"), unitId: form.get("unitId"), responsible: form.get("responsible"), startDate: form.get("startDate"), deadline: form.get("deadline") }),
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(result.error || "No se pudo registrar el proceso.");
      setModal(false);
      await load();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "No se pudo registrar el proceso.");
    } finally {
      setSaving(false);
    }
  }

  async function changeStatus(item: ProcurementItem, status: string) {
    if (!accessToken || status === item.status) return;
    setSaving(true);
    try {
      const response = await fetch("/api/contrataciones", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` }, body: JSON.stringify({ action: "set_status", id: item.id, status }) });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(result.error || "No se pudo actualizar el estado.");
      await load();
    } catch (statusError) {
      setError(statusError instanceof Error ? statusError.message : "No se pudo actualizar el estado.");
    } finally {
      setSaving(false);
    }
  }

  return <section className="moduleView procurementView"><div className="moduleTitle"><div><h2>Procesos de contratación</h2><p>Registro institucional desde la preparación hasta el pago</p></div>{canCreate && <button className="primaryAction" onClick={() => setModal(true)}><span>＋</span>Nuevo proceso</button>}</div>{error && <p className="formError" role="alert">{error}</p>}<div className="statGrid compactStats"><article className="procurementMetric"><span>Procesos activos</span><strong>{active.length}</strong><small>En seguimiento</small></article><article className="procurementMetric"><span>Monto referencial activo</span><strong>{money(String(amountActive))}</strong><small>Valor acumulado</small></article><article className="procurementMetric"><span>Concluidos</span><strong>{data.items.filter((item) => item.status === "concluido").length}</strong><small>Registro histórico</small></article><article className="procurementMetric"><span>Total registrado</span><strong>{data.items.length}</strong><small>Base institucional</small></article></div><div className="filterBar"><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar por código, objeto o unidad" /><button onClick={() => void load()}>Actualizar</button></div><section className="panel procurementTable"><div className="procurementTableHead"><span>Código</span><span>Objeto y unidad</span><span>Modalidad</span><span>Estado</span><span>Monto</span></div>{loading ? <p className="emptyState">Cargando procesos…</p> : filtered.length ? filtered.map((item) => <article className="procurementTableRow" key={item.id}><strong>{item.code}</strong><div><b>{item.object}</b><small>{item.unit}{item.responsible ? ` · ${item.responsible}` : ""}</small></div><span>{modalityLabels[item.modality] || item.modality}</span>{canUpdate ? <select value={item.status} disabled={saving} onChange={(event) => void changeStatus(item, event.target.value)} aria-label={`Estado de ${item.code}`}>{Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select> : <i className="status progress">{statusLabels[item.status] || item.status}</i>}<b>{money(item.amount)}</b></article>) : <p className="emptyState">Aún no existen procesos de contratación registrados.</p>}</section>{modal && <div className="modalBackdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setModal(false); }}><form className="routeModal" onSubmit={submit} role="dialog" aria-modal="true" aria-labelledby="procurement-title"><header className="modalHeader"><div><span>CONTRATACIONES</span><h2 id="procurement-title">Registrar nuevo proceso</h2></div><button type="button" onClick={() => setModal(false)} aria-label="Cerrar">×</button></header><label>Objeto de contratación<input name="object" required maxLength={300} placeholder="Bien, obra o servicio requerido" /></label><div className="formGrid"><label>Modalidad<select name="modality" defaultValue="menor">{Object.entries(modalityLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label>Monto referencial (Bs)<input name="amount" type="number" min="0" step="0.01" required /></label></div><label>Unidad solicitante<select name="unitId" required defaultValue=""><option value="" disabled>Selecciona una unidad</option>{data.units.map((unit) => <option key={unit.id} value={unit.id}>{unit.name}</option>)}</select></label><label>Responsable<input name="responsible" maxLength={220} placeholder="Nombre del responsable del proceso" /></label><div className="formGrid"><label>Fecha de inicio<input name="startDate" type="date" required defaultValue={getMunicipalIsoDate()} /></label><label>Fecha límite<input name="deadline" type="date" /></label></div><div className="modalActions"><button type="button" onClick={() => setModal(false)}>Cancelar</button><button className="primaryAction" type="submit" disabled={saving}>{saving ? "Registrando…" : "Registrar proceso →"}</button></div></form></div>}</section>;
}
