#!/bin/sh
docker build -t contrasleuth-crosscompile-images/cross-utils:aarch64-linux-android ./contrasleuth-crosscompile-images/aarch64-linux-android
docker build -t contrasleuth-crosscompile-images/cross-utils:arm-linux-androideabi ./contrasleuth-crosscompile-images/arm-linux-androideabi
docker build -t contrasleuth-crosscompile-images/cross-utils:armv7-linux-androideabi ./contrasleuth-crosscompile-images/armv7-linux-androideabi
docker build -t contrasleuth-crosscompile-images/cross-utils:i686-linux-android ./contrasleuth-crosscompile-images/i686-linux-android
docker build -t contrasleuth-crosscompile-images/cross-utils:x86_64-linux-android ./contrasleuth-crosscompile-images/x86_64-linux-android
