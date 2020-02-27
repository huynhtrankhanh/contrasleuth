package network.parlance

import android.content.Context
import android.os.Build
import android.os.Bundle
import android.util.Log
import com.getcapacitor.BridgeActivity
import com.getcapacitor.Plugin
import java.io.*
import java.util.*

class MainActivity : BridgeActivity() {
    @Throws(IOException::class)
    fun getCacheFile(context: Context, filename: String): File = File(context.cacheDir, filename)
            .also {
                it.outputStream().use { cache -> context.assets.open(filename).use { it.copyTo(cache) } }
            }

    public override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        val executable = when (Build.SUPPORTED_ABIS[0]) {
            "arm64-v8a" -> getCacheFile(this, "parlance-aarch64-linux-android")
            "armeabi" -> getCacheFile(this, "parlance-arm-linux-androideabi")
            "armeabi-v7a" -> getCacheFile(this, "parlance-armv7-linux-androideabi")
            "x86" -> getCacheFile(this, "parlance-i686-linux-android")
            "x86_64" -> getCacheFile(this, "parlance-x86_64-linux-androideabi")
            else -> getCacheFile(this, "parlance-arm-linux-androideabi")
        }
        executable.setExecutable(true)
        val sh = Runtime.getRuntime().exec(executable.path + " --help")
        val outputStream = DataOutputStream(sh.outputStream)
        val bufferedInputStream = BufferedReader(InputStreamReader(sh.inputStream))
        while (true) {
            val line = bufferedInputStream.readLine() ?: break
            Log.e("TAG", line)
        }

        // Initializes the Bridge
        init(savedInstanceState, object : ArrayList<Class<out Plugin?>?>() {
        })
    }
}