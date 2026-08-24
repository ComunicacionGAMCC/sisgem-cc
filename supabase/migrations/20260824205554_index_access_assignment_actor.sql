create index user_role_assignments_assigned_by_idx
  on access_control.user_role_assignments (assigned_by)
  where assigned_by is not null;
