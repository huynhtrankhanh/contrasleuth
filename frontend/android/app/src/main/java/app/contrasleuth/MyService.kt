package app.contrasleuth

import android.Manifest
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.pm.PackageManager
import android.net.wifi.WifiManager
import android.net.wifi.p2p.WifiP2pManager
import android.net.wifi.p2p.nsd.WifiP2pDnsSdServiceInfo
import android.os.Build
import android.os.IBinder
import android.os.Looper
import android.util.Log
import androidx.annotation.RequiresApi
import androidx.core.app.ActivityCompat
import androidx.core.app.NotificationCompat
import androidx.localbroadcastmanager.content.LocalBroadcastManager
import java.io.BufferedReader
import java.io.File
import java.io.IOException
import java.io.InputStreamReader

// https://stackoverflow.com/questions/47531742
class MyService : Service() {
    val TAG = "TAG"

    @Throws(IOException::class)
    fun getCacheFile(context: Context, filename: String): File = File(context.cacheDir, filename)
            .also {
                it.outputStream().use { cache -> context.assets.open(filename).use { it.copyTo(cache) } }
            }

    // Adapted from https://android.googlesource.com/platform/development/+/master/samples/WiFiDirectDemo/src/com/example/android/wifidirect/WiFiDirectActivity.java
    fun establishP2p() {
        if (!getPackageManager().hasSystemFeature(PackageManager.FEATURE_WIFI_DIRECT)) {
            Log.e(TAG, "Wi-Fi Direct is not supported by this device.")
            return
        }

        val appContext = getApplicationContext()

        val wifiManager = appContext.getSystemService(Context.WIFI_SERVICE) as WifiManager
        if (wifiManager == null) {
            Log.e(TAG, "Cannot get Wi-Fi system service.")
            return
        }

        if (!wifiManager.isP2pSupported()) {
            Log.e(TAG, "Wi-Fi Direct is not supported by the hardware or Wi-Fi is off.")
            return
        }

        val manager = appContext.getSystemService(Context.WIFI_P2P_SERVICE) as WifiP2pManager

        if (manager == null) {
            Log.e(TAG, "Cannot get Wi-Fi Direct system service.")
            return
        }

        val channel = manager.initialize(this, Looper.getMainLooper(), null)

        if (channel == null) {
            Log.e(TAG, "Cannot initialize Wi-Fi Direct.")
            return
        }

        val intentFilter = IntentFilter().apply {
            addAction(WifiP2pManager.WIFI_P2P_STATE_CHANGED_ACTION)
            addAction(WifiP2pManager.WIFI_P2P_PEERS_CHANGED_ACTION)
            addAction(WifiP2pManager.WIFI_P2P_CONNECTION_CHANGED_ACTION)
            addAction(WifiP2pManager.WIFI_P2P_THIS_DEVICE_CHANGED_ACTION)
        }

        // Adapted from https://developer.android.com/guide/topics/connectivity/wifip2p
        registerReceiver(object : BroadcastReceiver() {
            override fun onReceive(context: Context, intent: Intent) {
                val action: String = intent.action!!
                when (action) {
                    WifiP2pManager.WIFI_P2P_STATE_CHANGED_ACTION -> {
                        // Check to see if Wi-Fi is enabled and notify appropriate activity.
                    }
                    WifiP2pManager.WIFI_P2P_PEERS_CHANGED_ACTION -> {
                        // Call WifiP2pManager.requestPeers() to get a list of current peers.
                    }
                    WifiP2pManager.WIFI_P2P_CONNECTION_CHANGED_ACTION -> {
                        // Respond to new connection or disconnections.
                    }
                    WifiP2pManager.WIFI_P2P_THIS_DEVICE_CHANGED_ACTION -> {
                        // Respond to this device's wifi state changing.
                    }
                }
            }
        }, intentFilter)

        // Clear local services before broadcasting: https://stackoverflow.com/a/31641302
        manager.clearLocalServices(channel, object : WifiP2pManager.ActionListener {
            override fun onSuccess() {
                // ACCESS_FINE_LOCATION permission was already requested in main.
                if (ActivityCompat.checkSelfPermission(applicationContext, Manifest.permission.ACCESS_FINE_LOCATION) != PackageManager.PERMISSION_GRANTED) {
                    return
                }

                val record = mapOf("key" to "value")
                val info = WifiP2pDnsSdServiceInfo.newInstance(
                        "_quic-tunnel._contrasleuth-mvp",
                        "_quic-tunnel._contrasleuth-mvp",
                        record
                )

                manager.addLocalService(channel, info, object : WifiP2pManager.ActionListener {
                    override fun onSuccess() {
                        // Handle success.
                    }

                    override fun onFailure(reason: Int) {
                        // Handle failure.
                    }
                })
            }

            override fun onFailure(reason: Int) {
                // Handle failure.
            }
        })
    }

    override fun onCreate() {
        establishP2p();

        val channelId =
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    createNotificationChannel("my_service", "Contrasleuth")
                } else {
                    ""
                }

        val notification = NotificationCompat.Builder(this, channelId)
                .setOngoing(true).build()
        startForeground(2020, notification)

        val executable = when (Build.SUPPORTED_ABIS[0]) {
            "arm64-v8a" -> getCacheFile(this, "contrasleuth-aarch64-linux-android")
            "armeabi" -> getCacheFile(this, "contrasleuth-arm-linux-androideabi")
            "armeabi-v7a" -> getCacheFile(this, "contrasleuth-armv7-linux-androideabi")
            "x86" -> getCacheFile(this, "contrasleuth-i686-linux-android")
            "x86_64" -> getCacheFile(this, "contrasleuth-x86_64-linux-androideabi")
            else -> getCacheFile(this, "contrasleuth-arm-linux-androideabi")
        }
        executable.setExecutable(true)
        val dataDirectory = this.filesDir.absolutePath
        val sh = Runtime.getRuntime().exec(arrayOf(
                executable.path,
                "--address", "0.0.0.0:0",
                "--reverse-address", "0.0.0.0:0",
                "--database", "$dataDirectory/backend.sqlite",
                "--frontend-database", "$dataDirectory/frontend.sqlite"
        ))
        val outputStream = sh.outputStream
        val bufferedInputStream = BufferedReader(InputStreamReader(sh.inputStream))

        val localBroadcastManager = LocalBroadcastManager.getInstance(this)

        val thread1: Thread = object : Thread() {
            override fun run() {
                while (true) {
                    val line = bufferedInputStream.readLine() ?: break
                    val intent = Intent("stdout line")
                    intent.putExtra("line", line)
                    localBroadcastManager.sendBroadcast(intent)
                }
            }
        }

        thread1.start()

        val thread2: Thread = object : Thread() {
            override fun run() {
                val receiver: BroadcastReceiver = object : BroadcastReceiver() {
                    override fun onReceive(context: Context, intent: Intent) {
                        val line = intent.getStringExtra("line")
                        outputStream.write(line.toByteArray())
                        outputStream.flush()
                    }
                }

                localBroadcastManager.registerReceiver(receiver, IntentFilter("stdin line"))
            }
        }

        thread2.start()
    }

    @RequiresApi(Build.VERSION_CODES.O)
    private fun createNotificationChannel(channelId: String, channelName: String): String{
        val chan = NotificationChannel(channelId, channelName, NotificationManager.IMPORTANCE_NONE)
        chan.lockscreenVisibility = Notification.VISIBILITY_PRIVATE
        val service = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        service.createNotificationChannel(chan)
        return channelId
    }

    override fun onBind(intent: Intent): IBinder {
        TODO("Return the communication channel to the service.")
    }
}
