# Contrasleuth

Contrasleuth was an end-to-end encrypted messaging app on Android that was designed to work without the internet. The project ultimately failed.

This project is a good demonstration of my skills back then. These days I'm even better at coding.

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

### Backend

The backend is the Contrasleuth process written in Rust.

The backend of the application is structured around generating and managing keys and messages in an encrypted communication system. It uses cryptographic libraries to create key pairs and encrypt/decrypt messages, with added features such as autosaving and labelling. 

At the start, the backend initializes an inventory system to store messages and sets up a database connection. It then waits to receive commands to create a new 'inbox', set preferences, get a public key entry, encode or save a message, and more. 

The 'inbox' is essentially equivalent to an account. Each inbox has a unique id, label, public encryption key, private encryption key and an autosave preference. 

After receiving a command to create an inbox, it generates a key pair both for encryption and signing. These public keys (public_encryption_key and public_signing_key) are then used to identify the inbox by forming a "global id". 

Unsaved messages are removed from the database when they expire. If a saved message expires, it is flagged but not removed. 

One special feature is the ability to encode messages that can be sent to 'hidden' recipients. These are recipients whose public keys are not disclosed in the usual recipient list.

### Encryption Algorithm

The encryption algorithm works by taking plaintext data and an array of public keys as input. 

Firstly, a new, unique nonce and key pair are generated for this message. The nonce is saved into the output ciphertext, followed by the public key of the pair. Then, a new secret key is created.

Next, the secret key and the number of intended recipients of the message are merged together. The algorithm cycles through each public key, creating a shared key from each public key and the private key from the previously generated pair. An intermediate ciphertext is created by encrypting the merged secret key and recipient count using this shared key, and this intermediate ciphertext is saved to the output as well. 

Finally, the plaintext is encrypted using the original secret key and nonce, and this final ciphertext is appended to the output. 

The decryption of the ciphertext follows a reverse process. It keeps extracting bytes to restore the nonce, the public key and intermediate ciphertexts. Each intermediate ciphertext is tried to be decrypted with a shared key generated from the decoder's private key and the originally stored public key. 

The first successful decryption reveals a key that can decrypt the actual message and the remaining number of recipients. It then skips over the intermediate ciphertexts for the remaining recipients and proceeds to decrypt the actual message. 

If the decryption is not successful, it keeps advancing to the next intermediate ciphertext, until it finds one it can decrypt or it runs out of bytes. 

It should be noted that this algorithm is designed to work with multiple recipients. Each recipient would have the ability to decrypt the main message using their own private key.

### Frontend

The frontend is built with React and MobX for state management. It also uses Ionic for UI components, React Router for navigation, Fluent for internationalization, and Framer for animation.

Starting with the landing page, the application allows users to select, create, or view the details of an inbox, which can be performed via different functional pages. The information held in each inbox is propagated through the application and displayed alongside related functions. If an inbox isn't found, the application displays an error page.

For creating an inbox, the application provides form input and functions to add and manage contact names. Elsewhere, options for setting up an inbox include renaming it, setting up message autosave preferences, and deleting the inbox.

In a selected inbox, users have the ability to interact with their messages. Options for this include adding recipients (either disclosed or hidden), setting a message expiration time of one, four, or seven days, and message attachment handling. Message handling also includes functions for marking messages as read, hiding messages, and saving messages. 

Moreover, users can reply to messages, and any messages that are replied to are nested underneath the initial message.

Other interactions include being able to access contact lists, add contacts to this list, and manage details of individual contacts, such as renaming entries or editing contact's Inbox ID.

## Video Demo

*TODO*

## Build Process

Unfortunately, this piece of software is pretty hard to build. You need to install Docker, Node.js, Rust and Cargo. You can partially run the app on desktop but to actually build the Android app, you also need Android Studio.

To partially run the app on desktop:

**Run backend:**
```sh
cd stdio-socketio-proxy
npm start
```

**Run frontend:**
```sh
cd frontend
npm start
```

To build the Android app:

**Build Rust binaries:**
```sh
cd frontend
npm run assemble
```

Then go through the instructions at https://ionicframework.com/docs/developing/android to run the app on Android.
