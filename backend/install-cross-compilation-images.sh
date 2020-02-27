#!/bin/sh
docker build -t parlance-crosscompile-images/cross-utils:aarch64-linux-android ./parlance-crosscompile-images/aarch64-linux-android
docker build -t parlance-crosscompile-images/cross-utils:arm-linux-androideabi ./parlance-crosscompile-images/arm-linux-androideabi
docker build -t parlance-crosscompile-images/cross-utils:armv7-linux-androideabi ./parlance-crosscompile-images/armv7-linux-androideabi
docker build -t parlance-crosscompile-images/cross-utils:i686-linux-android ./parlance-crosscompile-images/i686-linux-android
docker build -t parlance-crosscompile-images/cross-utils:x86_64-linux-android ./parlance-crosscompile-images/x86_64-linux-android
