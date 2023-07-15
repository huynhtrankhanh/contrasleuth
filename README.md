# Contrasleuth

Contrasleuth was an end-to-end encrypted messaging app on Android that was designed to work without the internet. The project ultimately failed.

**Press coverage:** https://thanhnien.vn/cau-hoc-tro-dam-me-nghien-cuu-khoa-hoc-185926739.htm

## Design

The project uses a mix of Rust, TypeScript and Kotlin. It has four components:
- Backend (Rust)
- Frontend (TypeScript)
- Transport layer (Rust)
- Outer shell (Kotlin)

The transport layer is a modified version of the `quinn` library.

The outer shell is written with Ionic Framework and has Kotlin code to connect backend, frontend and transport layer together. The transport layer also has code to leverage native APIs for communication.

## Video Demo

*TODO*
