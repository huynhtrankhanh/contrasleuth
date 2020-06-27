#!/bin/sh
ionic cap copy
cd ../backend
cross build --target=aarch64-linux-android --release
mv ./target/aarch64-linux-android/release/contrasleuth ../frontend/android/app/src/main/assets/contrasleuth-aarch64-linux-android
cd ../frontend
