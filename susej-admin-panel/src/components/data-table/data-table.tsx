"use client";

import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  type ColumnDef,
  type SortingState,
  type ColumnFiltersState,
  type VisibilityState,
  flexRender,
} from "@tanstack/react-table";
import { useState, useMemo, useCallback } from "react";
import { ChevronUp, ChevronDown, ChevronsUpDown, ChevronLeft, ChevronRight, Download, Columns, FileSpreadsheet } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { SearchInput } from "@/components/shared/search-input";
import { EmptyState } from "@/components/shared/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import { DropdownMenu, DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { BulkActionsBar } from "@/components/shared/bulk-actions-bar";
import { exportToCSV, exportToExcel } from "@/lib/export";

interface DataTableProps<TData> {
  columns: ColumnDef<TData, any>[];
  data: TData[];
  loading?: boolean;
  searchable?: boolean;
  searchKey?: string;
  pageSize?: number;
  onExportCSV?: () => void;
  toolbar?: React.ReactNode;
  selectable?: boolean;
  filename?: string;
  exportColumns?: { key: string; label: string }[];
  onRowClick?: (row: TData) => void;
  onBulkDelete?: (selectedRows: TData[]) => Promise<void> | void;
}

export function DataTable<TData>({
  columns,
  data,
  loading,
  searchable,
  searchKey,
  pageSize = 10,
  onExportCSV,
  toolbar,
  selectable,
  filename = "export",
  exportColumns,
  onRowClick,
  onBulkDelete,
}: DataTableProps<TData>) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [globalFilter, setGlobalFilter] = useState("");
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [rowSelection, setRowSelection] = useState({});

  const allColumns = useMemo(() => {
    if (!selectable) return columns;
    return [
      {
        id: "select",
        header: ({ table }) => (
          <Checkbox
            checked={table.getIsAllRowsSelected()}
            onChange={table.getToggleAllRowsSelectedHandler()}
          />
        ),
        cell: ({ row }) => (
          <Checkbox
            checked={row.getIsSelected()}
            onChange={row.getToggleSelectedHandler()}
          />
        ),
        enableSorting: false,
        enableHiding: false,
      } as ColumnDef<TData, any>,
      ...columns,
    ];
  }, [columns, selectable]);

  const table = useReactTable({
    data,
    columns: allColumns,
    state: { sorting, columnFilters, globalFilter, columnVisibility, rowSelection },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onGlobalFilterChange: setGlobalFilter,
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    // When searchKey is set, restrict global filter to that column only (industry: targeted search).
    // Otherwise fall back to default fuzzy across all visible cells.
    globalFilterFn: searchKey
      ? (row, _columnId, filterValue) => {
          const raw = row.getValue(searchKey);
          if (raw == null) return false;
          return String(raw).toLowerCase().includes(String(filterValue).toLowerCase());
        }
      : undefined,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize } },
  });

  const selectedCount = Object.keys(rowSelection).length;
  const visibleColumns = table.getAllLeafColumns();

  const handleExportCSV = () => {
    if (onExportCSV) {
      onExportCSV();
      return;
    }
    if (exportColumns) {
      const raw = data as Record<string, unknown>[];
      exportToCSV(raw, filename, exportColumns);
    }
  };

  const handleExportExcel = () => {
    if (exportColumns) {
      const raw = data as Record<string, unknown>[];
      exportToExcel(raw, filename, exportColumns);
    }
  };

  if (loading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-10 w-full" />
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {(searchable || onExportCSV || exportColumns || toolbar) && (
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            {searchable && (
              <SearchInput
                value={globalFilter}
                onChange={setGlobalFilter}
                placeholder="Search..."
                className="w-72"
              />
            )}
            {toolbar}
          </div>
          <div className="flex items-center gap-2">
            <DropdownMenu
              trigger={
                <Button variant="secondary" size="sm">
                  <Columns className="h-4 w-4" />
                  Columns
                </Button>
              }
            >
              {visibleColumns
                .filter((col) => col.id !== "select")
                .map((col) => (
                  <DropdownMenuItem
                    key={col.id}
                    onClick={() => col.toggleVisibility()}
                  >
                    <Checkbox checked={col.getIsVisible()} />
                    <span className="capitalize">{col.id}</span>
                  </DropdownMenuItem>
                ))}
            </DropdownMenu>
            {exportColumns && (
              <>
                <Button variant="secondary" size="sm" onClick={handleExportCSV}>
                  <Download className="h-4 w-4" />
                  CSV
                </Button>
                <Button variant="secondary" size="sm" onClick={handleExportExcel}>
                  <FileSpreadsheet className="h-4 w-4" />
                  Excel
                </Button>
              </>
            )}
          </div>
        </div>
      )}

      <div className="overflow-x-auto rounded-[6px] bg-white">
        <table className="w-full">
          <thead>
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id} className="border-b border-[#E4E4E7] bg-[#FAFAFA]">
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    className="px-4 py-2.5 text-left text-[13px] font-medium text-[#71717A]"
                  >
                    {header.isPlaceholder ? null : (
                      <button
                        className={cn(
                          "flex items-center gap-1",
                          header.column.getCanSort() && "cursor-pointer select-none"
                        )}
                        onClick={header.column.getToggleSortingHandler()}
                      >
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        {{
                          asc: <ChevronUp className="h-3.5 w-3.5" />,
                          desc: <ChevronDown className="h-3.5 w-3.5" />,
                        }[header.column.getIsSorted() as string] ??
                          (header.column.getCanSort() && <ChevronsUpDown className="h-3.5 w-3.5 text-gray-300" />)}
                      </button>
                    )}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.length === 0 ? (
              <tr>
                <td colSpan={allColumns.length} className="px-4 py-12">
                  <EmptyState />
                </td>
              </tr>
            ) : (
              table.getRowModel().rows.map((row) => (
                <tr
                  key={row.id}
                  className={cn(
                    "border-b border-[#E4E4E7] transition-colors last:border-0",
                    onRowClick ? "cursor-pointer hover:bg-[#F5F3FF]/60" : "hover:bg-gray-50",
                    row.getIsSelected() && "bg-[#6C3BFF]/5"
                  )}
                  onClick={onRowClick ? () => onRowClick(row.original) : undefined}
                >
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="px-4 py-3 text-sm text-[#18181B] ">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {table.getPageCount() > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-500">
            Page {table.getState().pagination.pageIndex + 1} of {table.getPageCount()}
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {selectable && onBulkDelete && (
        <BulkActionsBar
          selectedCount={selectedCount}
          actions={[
            {
              label: "Delete Selected",
              variant: "danger",
              onClick: async () => {
                const rows = table.getFilteredSelectedRowModel().rows.map((r) => r.original);
                if (!rows.length) return;
                if (!confirm(`Soft-delete ${rows.length} selected row(s)? (use row menu hard-delete to permanently remove)`)) return;
                await onBulkDelete(rows);
                setRowSelection({});
              },
            },
          ]}
        />
      )}
    </div>
  );
}
