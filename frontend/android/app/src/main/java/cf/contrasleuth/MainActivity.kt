package cf.contrasleuth

import android.Manifest
import android.annotation.TargetApi
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.pm.PackageManager
import android.os.Bundle
import android.support.v4.app.ActivityCompat
import android.support.v4.content.LocalBroadcastManager
import android.util.Log
import com.getcapacitor.*
import org.json.JSONObject
import java.util.*

@NativePlugin
class EchoPlugin : Plugin() {
    override fun load() {
        val localBroadcastManager = LocalBroadcastManager.getInstance(context)

        val receiver: BroadcastReceiver = object : BroadcastReceiver() {
            override fun onReceive(context: Context, intent: Intent) {
                val line = intent.getStringExtra("line")
                val json = JSONObject()
                json.put("line", line)
                bridge.triggerWindowJSEvent("stdout line", json.toString())
            }
        }

        localBroadcastManager.registerReceiver(receiver, IntentFilter("stdout line"))
    }

    @PluginMethod
    fun send(call: PluginCall) {
        val localBroadcastManager = LocalBroadcastManager.getInstance(context)

        val line = call.getString("line")
        val ret = JSObject()

        val intent = Intent("stdin line")
        intent.putExtra("line", line)
        localBroadcastManager.sendBroadcast(intent)

        call.success(ret)
    }
}

class MainActivity : BridgeActivity() {
    private val locationRequestCode = 2020

    @TargetApi(26)
    override fun onRequestPermissionsResult(requestCode: Int,
                                            permissions: Array<String>, grantResults: IntArray) {
        val localBroadcastManager = LocalBroadcastManager.getInstance(this)
        when (requestCode) {
            locationRequestCode -> {
                if (grantResults.isEmpty() || grantResults[0] != PackageManager.PERMISSION_GRANTED) {
                    this.finishAffinity()
                } else {
                    val intent = Intent(this, MyService::class.java)
                    this.startService(intent)

                    Timer().scheduleAtFixedRate(object : TimerTask() {
                        override fun run() {
                            run {
                                val json = JSONObject()
                                val nested = JSONObject()
                                nested.put("address", "192.168.43.96:4016")
                                nested.put("operation_id", UUID.randomUUID().toString())
                                json.put("EstablishConnection", nested)
                                val intent = Intent("stdin line")
                                intent.putExtra("line", Base64.getEncoder().encodeToString(json.toString().toByteArray()) + "\n")
                                localBroadcastManager.sendBroadcast(intent)
                            }

                            run {
                                val json = JSONObject()
                                val nested = JSONObject()
                                nested.put("address", "192.168.43.96:4017")
                                nested.put("operation_id", UUID.randomUUID().toString())
                                json.put("EstablishReverseConnection", nested)
                                val intent = Intent("stdin line")
                                intent.putExtra("line", Base64.getEncoder().encodeToString(json.toString().toByteArray()) + "\n")
                                localBroadcastManager.sendBroadcast(intent)
                            }
                        }
                    }, 0, 5000)
                }
            }
        }
    }

    public override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        init(savedInstanceState, object : ArrayList<Class<out Plugin?>?>() {
            init {
                add(EchoPlugin::class.java)
            }
        })

        ActivityCompat.requestPermissions(this, arrayOf(Manifest.permission.ACCESS_FINE_LOCATION), locationRequestCode)
    }
}
