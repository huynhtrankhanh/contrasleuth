package cf.contrasleuth

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.net.wifi.p2p.WifiP2pManager
import android.net.wifi.p2p.WifiP2pManager.WIFI_P2P_CONNECTION_CHANGED_ACTION
import android.os.Build
import android.os.IBinder
import android.os.Parcelable
import android.support.annotation.RequiresApi
import android.support.v4.app.NotificationCompat
import android.support.v4.content.LocalBroadcastManager
import android.util.Log
import java.io.BufferedReader
import java.io.File
import java.io.IOException
import java.io.InputStreamReader
import org.json.JSONObject
import java.util.*

// https://stackoverflow.com/questions/47531742
class MyService : Service() {
    @Throws(IOException::class)
    fun getCacheFile(context: Context, filename: String): File = File(context.cacheDir, filename)
            .also {
                it.outputStream().use { cache -> context.assets.open(filename).use { it.copyTo(cache) } }
            }

    override fun onCreate() {
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
