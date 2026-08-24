import React, { act, useState } from "react";
import { createRoot } from "react-dom/client";
import { LanguageProvider } from "../../contexts/LanguageContext.jsx";
import AdminPagination from "./AdminPagination.jsx";
import ConfirmActionDialog from "./ConfirmActionDialog.jsx";
import DataTable from "./DataTable.jsx";
import SearchInput from "./SearchInput.jsx";

function ConfirmHarness({ onConfirm }) {
  const [open, setOpen] = useState(false);
  return (
    <ConfirmActionDialog
      open={open}
      onOpenChange={setOpen}
      title="Hapus data?"
      description="Data tidak dapat dikembalikan."
      confirmLabel="Hapus"
      destructive
      onConfirm={onConfirm}
    >
      <button type="button">Buka konfirmasi</button>
    </ConfirmActionDialog>
  );
}

describe("admin data table foundation", () => {
  let root;

  beforeEach(() => {
    global.IS_REACT_ACT_ENVIRONMENT = true;
    localStorage.setItem("lang", "id");
    document.body.innerHTML = '<div id="root"></div>';
  });

  afterEach(async () => {
    if (root) await act(async () => root.unmount());
    root = null;
    document.body.innerHTML = "";
    jest.useRealTimers();
  });

  const render = async (node) => {
    root = createRoot(document.getElementById("root"));
    await act(async () => root.render(<LanguageProvider>{node}</LanguageProvider>));
  };

  test("renders semantic desktop rows and responsive mobile cards", async () => {
    const onSort = jest.fn();
    await render(
      <DataTable
        columns={[
          { key: "name", header: "Nama", sortable: true },
          { key: "status", header: "Status" },
        ]}
        items={[{ id: "1", name: "Danau Toba", status: "Aktif" }]}
        sort="name"
        onSort={onSort}
        caption="Daftar destinasi"
      />,
    );
    expect(document.querySelector("table")).not.toBeNull();
    expect(document.querySelector("tbody tr").textContent).toContain("Danau Toba");
    expect(document.querySelector("article").textContent).toContain("Danau Toba");
    await act(async () => document.querySelector('th button[aria-label="Urutkan berdasarkan Nama"]').click());
    expect(onSort).toHaveBeenCalledWith("-name");
  });

  test("distinguishes filtered empty state", async () => {
    await render(<DataTable columns={[{ key: "name", header: "Nama" }]} items={[]} hasActiveFilters />);
    expect(document.querySelector('[data-testid="data-table-empty"]').textContent).toContain("Data tidak ditemukan");
  });

  test("shows a responsive skeleton while loading", async () => {
    await render(<DataTable columns={[{ key: "name", header: "Nama" }]} loading />);
    expect(document.querySelector('[data-testid="data-table-skeleton"]')).not.toBeNull();
    expect(document.querySelector('[aria-busy="true"]')).not.toBeNull();
  });

  test("debounces search input before updating list state", async () => {
    jest.useFakeTimers();
    const onChange = jest.fn();
    await render(<SearchInput value="" onChange={onChange} debounceMs={350} />);
    const input = document.querySelector('input[type="search"]');
    await act(async () => {
      const setInputValue = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
      setInputValue.call(input, "toba");
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await act(async () => jest.advanceTimersByTime(349));
    expect(onChange).not.toHaveBeenCalled();
    await act(async () => jest.advanceTimersByTime(1));
    expect(onChange).toHaveBeenCalledWith("toba");
    jest.useRealTimers();
  });

  test("pagination changes page and page size", async () => {
    const onPageChange = jest.fn();
    const onPageSizeChange = jest.fn();
    await render(<AdminPagination page={1} pageSize={25} total={80} onPageChange={onPageChange} onPageSizeChange={onPageSizeChange} />);
    await act(async () => document.querySelector('button[aria-label="Halaman 2"]').click());
    expect(onPageChange).toHaveBeenCalledWith(2);
    const select = document.querySelector("select");
    await act(async () => {
      select.value = "50";
      select.dispatchEvent(new Event("change", { bubbles: true }));
    });
    expect(onPageSizeChange).toHaveBeenCalledWith(50);
  });

  test("confirmation dialog requires an explicit action", async () => {
    const onConfirm = jest.fn();
    await render(<ConfirmHarness onConfirm={onConfirm} />);
    await act(async () => document.querySelector("button").click());
    expect(document.body.textContent).toContain("Hapus data?");
    const confirmButton = Array.from(document.querySelectorAll("button")).find((button) => button.textContent === "Hapus");
    await act(async () => confirmButton.click());
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });
});
