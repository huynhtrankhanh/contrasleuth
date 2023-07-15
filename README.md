# Contrasleuth

Contrasleuth was an end-to-end encrypted messaging app on Android that was designed to work without the internet. The project ultimately failed.

**Press coverage:** https://thanhnien.vn/cau-hoc-tro-dam-me-nghien-cuu-khoa-hoc-185926739.htm

## Design

The project uses a mix of Rust, TypeScript and Kotlin. It has four components:
- Backend (Rust)
- Frontend (TypeScript)
- Transport layer (Rust)
- Outer shell (Kotlin)

The transport layer is a modified version of the `quinn` library. Because of bit rot, the transport layer no longer compiles. Other components are still functional. The transport layer gathers nearby packets and turns them into QUIC data streams. It also sends out packets with appropriate congestion control to ensure reliable delivery. Most of the work is done by the `quinn` library itself and there are only minor modifications to make it work with the rest of the project.

The outer shell is written with Ionic Framework and has Kotlin code to connect backend, frontend and transport layer together. The transport layer also has code to leverage native APIs for communication.

## Video Demo

*TODO*
