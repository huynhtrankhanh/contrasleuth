package app.contrasleuth

import android.Manifest
import android.annotation.SuppressLint
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
import android.net.wifi.p2p.WifiP2pDevice
import android.net.wifi.p2p.WifiP2pManager
import android.net.wifi.p2p.nsd.WifiP2pDnsSdServiceInfo
import android.net.wifi.p2p.nsd.WifiP2pDnsSdServiceRequest
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.util.Log
import androidx.annotation.RequiresApi
import androidx.core.app.NotificationCompat
import androidx.localbroadcastmanager.content.LocalBroadcastManager
import java.io.BufferedReader
import java.io.File
import java.io.InputStreamReader
import java.util.*

// https://stackoverflow.com/questions/47531742
class MyService : Service() {
    val TAG = "TAG"
    val shibboleth = "d700f843-76c5-4fc1-9485-e1309081020a"

    var manager: WifiP2pManager? = null
    var channel: WifiP2pManager.Channel? = null
    var handler: Handler? = null
    var runnable: Runnable? = null
    var localBroadcastManager: LocalBroadcastManager? = null
    var serviceRequest: WifiP2pDnsSdServiceRequest? = null

    private fun discoverServices() {
        val manager = manager!!
        val channel = channel!!
        val handler = handler!!
        val runnable = runnable!!
        val localBroadcastManager = localBroadcastManager!!

        manager.setDnsSdResponseListeners(
                channel,
                WifiP2pManager.DnsSdServiceResponseListener { _, _, _ ->
                    Log.wtf(TAG, "Detected a service")
                },
                object : WifiP2pManager.DnsSdTxtRecordListener {
                    override fun onDnsSdTxtRecordAvailable(fullDomainName: String, txtRecordMap: MutableMap<String, String>, srcDevice: WifiP2pDevice?) {
                        if (!fullDomainName.contains(shibboleth)) {
                            Log.wtf(TAG, "Received a packet from another app.")
                            return
                        }

                        var accumulatedPayload = ""

                        fun processKey(key: String) {
                            val payload = txtRecordMap[key];
                            if (payload != null) {
                                accumulatedPayload += payload;
                            }
                        }

                        processKey("a");
                        processKey("b");
                        processKey("c");
                        processKey("d");
                        processKey("e");
                        processKey("f");
                        processKey("g");
                        processKey("h");
                        processKey("i");
                        processKey("j");
                        processKey("k");
                        processKey("l");
                        processKey("m");
                        processKey("n");
                        processKey("o");
                        processKey("p");
                        processKey("q");
                        processKey("r");
                        processKey("s");
                        processKey("t");
                        processKey("u");
                        processKey("v");
                        processKey("w");
                        processKey("x");
                        processKey("y");
                        processKey("z");

                        val intent = Intent("packet received")
                        Log.wtf("PACKET", accumulatedPayload)
                        intent.putExtra("payload", accumulatedPayload)
                        localBroadcastManager.sendBroadcast(intent)
                    }
                }
        )

        val serviceRequest = serviceRequest!!
        manager.removeServiceRequest(channel, serviceRequest,
                object : WifiP2pManager.ActionListener {
                    override fun onSuccess() {
                        manager.addServiceRequest(channel, serviceRequest,
                                object : WifiP2pManager.ActionListener {
                                    @SuppressLint("MissingPermission")
                                    override fun onSuccess() {
                                        manager.discoverServices(channel,
                                                object : WifiP2pManager.ActionListener {
                                                    override fun onSuccess() {
                                                        Log.wtf(TAG, "discoverServices call succeeded")
                                                        handler.postDelayed(runnable, 120000)
                                                    }

                                                    override fun onFailure(error: Int) {
                                                        Log.wtf(TAG, "discoverServices call failed " + error)
                                                    }
                                                })
                                    }

                                    override fun onFailure(error: Int) {
                                        Log.wtf(TAG, "Failed to add service request")
                                    }
                                }
                        )
                    }

                    override fun onFailure(reason: Int) {
                        Log.wtf(TAG, "Failed to remove service request")
                    }
                }
        )
    }

    // Adapted from https://android.googlesource.com/platform/development/+/master/samples/WiFiDirectDemo/src/com/example/android/wifidirect/WiFiDirectActivity.java
    private fun establishP2p() {
        if (!packageManager.hasSystemFeature(PackageManager.FEATURE_WIFI_DIRECT)) {
            Log.wtf(TAG, "Wi-Fi Direct is not supported by this device.")
            return
        }

        val appContext = applicationContext

        val wifiManager = appContext.getSystemService(Context.WIFI_SERVICE) as WifiManager

        if (!wifiManager.isP2pSupported()) {
            Log.wtf(TAG, "Wi-Fi Direct is not supported by the hardware or Wi-Fi is off.")
            return
        }

        manager = appContext.getSystemService(Context.WIFI_P2P_SERVICE) as WifiP2pManager

        if (manager == null) {
            Log.wtf(TAG, "Cannot get Wi-Fi Direct system service.")
            return
        }

        val manager = manager!!

        channel = manager.initialize(this, Looper.getMainLooper(), null)

        if (channel == null) {
            Log.wtf(TAG, "Cannot initialize Wi-Fi Direct.")
            return
        }

        serviceRequest = WifiP2pDnsSdServiceRequest.newInstance()

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
                        Log.wtf(TAG, "Wi-Fi P2P state changed")
                    }
                    WifiP2pManager.WIFI_P2P_PEERS_CHANGED_ACTION -> {
                        Log.wtf(TAG, "Wi-Fi P2P peers changed")
                    }
                    WifiP2pManager.WIFI_P2P_CONNECTION_CHANGED_ACTION -> {
                        Log.wtf(TAG, "Wi-Fi P2P connection changed")
                    }
                    WifiP2pManager.WIFI_P2P_THIS_DEVICE_CHANGED_ACTION -> {
                        Log.wtf(TAG, "The Wi-Fi P2P details of this device have changed")
                    }
                }
            }
        }, intentFilter)

        val localBroadcastManager = localBroadcastManager!!

        val receiver: BroadcastReceiver = object : BroadcastReceiver() {
            override fun onReceive(context: Context, intent: Intent) {
                val payload = intent.getStringExtra("payload")
                // Clear local services before broadcasting: https://stackoverflow.com/a/31641302
                manager.clearLocalServices(channel, object : WifiP2pManager.ActionListener {
                    @SuppressLint("MissingPermission")
                    override fun onSuccess() {
                        Log.wtf(TAG, "Cleared local services")

                        val record = mutableMapOf<String, String>()
                        val keys = arrayOf("a", "b", "c", "d", "e", "f", "g", "h", "i", "j", "k", "l", "m", "n", "o", "p", "q", "r", "s", "t", "u", "v", "w", "x", "y", "z")

                        val length = payload.length
                        var cursor: Int = 0;
                        var currentKey = 0

                        while (cursor != length && currentKey != 26) {
                            fun advance(cursor: Int): Int {
                                var current = cursor

                                while (true) {
                                    if (current == length) return length
                                    if (current - cursor >= 250) return current
                                    current++
                                }
                            }

                            val next = advance(cursor)
                            record[keys[currentKey]] = payload.subSequence(cursor, next).toString()

                            cursor = next
                            currentKey++
                        }

                        val info = WifiP2pDnsSdServiceInfo.newInstance(
                                UUID.randomUUID().toString(),
                                shibboleth,
                                record
                        )

                        manager.addLocalService(channel, info, object : WifiP2pManager.ActionListener {
                            override fun onSuccess() {
                                Log.wtf(TAG, "Added local service")
                            }

                            override fun onFailure(reason: Int) {
                                Log.wtf(TAG, "Failed to add local service")
                            }
                        })
                    }

                    override fun onFailure(reason: Int) {
                        // Handle failure.
                        Log.wtf(TAG, "Failed to clear services")
                    }
                })
            }
        }

        localBroadcastManager.registerReceiver(receiver, IntentFilter("broadcast packet"))

        handler = Handler()

        runnable = Runnable { discoverServices() }
        discoverServices()
    }

    fun broadcastPacket(payload: String) {
        val intent = Intent("broadcast packet")
        intent.putExtra("payload", payload)
        val localBroadcastManager = localBroadcastManager!!
        localBroadcastManager.sendBroadcast(intent)
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

        var libsDir = applicationInfo.nativeLibraryDir
        localBroadcastManager = LocalBroadcastManager.getInstance(this)

        fun initializeContrasleuth() {
            val executable = File(libsDir, "libcontrasleuth.so")

            val dataDirectory = this.filesDir.absolutePath

            File("$dataDirectory/server.sock").delete()
            File("$dataDirectory/client.sock").delete()

            val contrasleuthProcess = Runtime.getRuntime().exec(arrayOf(
                    executable.path,
                    "--unix-socket", "$dataDirectory/server.sock",
                    "--reverse-unix-socket", "$dataDirectory/client.sock",
                    "--database", "$dataDirectory/backend.sqlite",
                    "--frontend-database", "$dataDirectory/frontend.sqlite"
            ))
            val outputStream = contrasleuthProcess.outputStream
            val bufferedInputStream = BufferedReader(InputStreamReader(contrasleuthProcess.inputStream))

            establishP2p();

            val thread1: Thread = object : Thread() {
                override fun run() {
                    while (true) {
                        val line = bufferedInputStream.readLine() ?: break
                        val intent = Intent("stdout line")
                        intent.putExtra("line", line)
                        Log.d("STDOUT", line)

                        val localBroadcastManager = localBroadcastManager!!

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

                    val localBroadcastManager = localBroadcastManager!!

                    localBroadcastManager.registerReceiver(receiver, IntentFilter("stdin line"))
                }
            }

            thread2.start()
        }

        initializeContrasleuth()

        fun initializeQuinn() {
            val executable = File(libsDir, "libquinn.so")

            val dataDirectory = this.filesDir.absolutePath
            val quinnProcess = Runtime.getRuntime().exec(arrayOf(
                    executable.path,
                    "--server-socket", "$dataDirectory/server.sock",
                    "--client-socket", "$dataDirectory/client.sock"
            ))
            val outputStream = quinnProcess.outputStream
            val bufferedInputStream = BufferedReader(InputStreamReader(quinnProcess.inputStream))

            val thread1: Thread = object : Thread() {
                override fun run() {
                    while (true) {
                        val line = bufferedInputStream.readLine() ?: break
                        Log.wtf("STDOUT", line)
                        broadcastPacket(line)
                    }
                }
            }

            thread1.start()

            val thread2: Thread = object : Thread() {
                override fun run() {
                    val receiver: BroadcastReceiver = object : BroadcastReceiver() {
                        override fun onReceive(context: Context, intent: Intent) {
                            val line = intent.getStringExtra("payload")
                            outputStream.write(line.toByteArray())
                            outputStream.write("\n".toByteArray())
                            outputStream.flush()
                        }
                    }

                    val localBroadcastManager = localBroadcastManager!!

                    localBroadcastManager.registerReceiver(receiver, IntentFilter("packet received"))
                }
            }

            thread2.start()

            val bufferedErrorStream = BufferedReader(InputStreamReader(quinnProcess.errorStream))

            val thread3: Thread = object : Thread() {
                override fun run() {
                    while (true) {
                        val line = bufferedErrorStream.readLine() ?: break
                        Log.wtf("STDERR", line)
                    }
                }
            }

            thread3.start()
        }

        initializeQuinn()
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
