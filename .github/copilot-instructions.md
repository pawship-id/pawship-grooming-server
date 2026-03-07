# Copilot Instructions

## API Documentation Update Requirement

Setiap kali terjadi perubahan pada API — termasuk namun tidak terbatas pada:

- Menambahkan endpoint baru
- Mengubah path, method, atau parameter endpoint yang sudah ada
- Mengubah struktur request body atau response body
- Menambahkan, mengubah, atau menghapus query parameter
- Mengubah HTTP status code yang dikembalikan
- Mengubah logika autentikasi/otorisasi pada endpoint
- Menghapus endpoint

**Maka file `API_DOCUMENTATION.md` di root project WAJIB diperbarui** agar selalu sinkron dengan implementasi terkini.

### Panduan Update Dokumentasi

1. **Endpoint Baru** — Tambahkan section baru di `API_DOCUMENTATION.md` dengan format yang konsisten:
   - Method & path (e.g., `GET /resource/:id`)
   - Deskripsi singkat
   - Authentication (jika diperlukan)
   - Headers (jika ada)
   - Path/Query Parameters
   - Request Body (beserta tipe data dan keterangan required/optional)
   - Success Response (status code + contoh JSON)
   - Error Responses (status code + contoh JSON)
   - Notes (jika ada informasi tambahan penting)

2. **Perubahan pada Endpoint yang Ada** — Perbarui bagian yang relevan di dokumentasi yang sudah ada, termasuk contoh request/response jika strukturnya berubah.

3. **Endpoint Dihapus** — Hapus section dokumentasi endpoint tersebut dari `API_DOCUMENTATION.md`.

4. **Table of Contents** — Pastikan daftar isi di bagian atas `API_DOCUMENTATION.md` selalu mencerminkan section yang ada.

> ⚠️ Jangan menyelesaikan perubahan API tanpa memperbarui `API_DOCUMENTATION.md`. Dokumentasi harus selalu akurat dan up-to-date.
