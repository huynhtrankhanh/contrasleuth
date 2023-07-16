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

### General Flow

The app starts by creating a persistent notification channel, setting up local broadcasts, deleting any pre-existing socket files, and initializing two native processes. These processes, `Contrasleuth` and `Quinn` are written in Rust and interact with the app's code via standard input/output and attempted writes to Unix socket files. 

There are key threads in place for servicing each of these processes. For instance, there are threads that continuously read from the processes' standard output and broadcast any output via an 'stdout line' intent. Other threads are listening for 'stdin line' and 'packet received' intents to feed input back into the processes. 

The app communicates with other devices using Wi-Fi Direct and Wi-Fi P2P DNS-SD. It maintains parallel systems for sending and receiving information using these technologies: any packet to be sent is broadcast as a Wi-Fi P2P service and any packet received is through discovery of other devices' services. The payload in these packets is broken into pieces and sent across multiple DNS-SD TXT records. 

Finally, the app loops the service discovery process every two minutes to continuously check for incoming packets. All important events and operations are logged.

## Backend

The backend is the Contrasleuth process written in Rust.

The backend of the application is structured around generating and managing keys and messages in an encrypted communication system. It uses cryptographic libraries to create key pairs and encrypt/decrypt messages, with added features such as autosaving and labelling. 

At the start, the backend initializes an inventory system to store messages and sets up a database connection. It then waits to receive commands to create a new 'inbox', set preferences, get a public key entry, encode or save a message, and more. 

The 'inbox' is essentially equivalent to an account. Each inbox has a unique id, label, public encryption key, private encryption key and an autosave preference. 

After receiving a command to create an inbox, it generates a key pair both for encryption and signing. These public keys (public_encryption_key and public_signing_key) are then used to identify the inbox by forming a "global id". 

Unsaved messages are removed from the database when they expire. If a saved message expires, it is flagged but not removed. 

One special feature is the ability to encode messages that can be sent to 'hidden' recipients. These are recipients whose public keys are not disclosed in the usual recipient list.

## Video Demo

*TODO*
