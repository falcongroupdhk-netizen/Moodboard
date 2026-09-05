# Android Companion App Integration & Bidirectional Sync Prompt

> **Copy and paste the prompt below into your Android developer assistant or use it in Android Studio to build the connected mobile app.**

---

```markdown
# TASK: Build or Connect the Android Moodboard Companion App with Atelier Web Hub

You are building the native Android Companion App for "Atelier Moodboard Companion". This mobile app allows interior designers and architects to capture high-resolution imagery and material specifications on-site and maintain bidirectional, two-way synchronization with the Atelier Web App and Google Workspace (Google Drive & Google Sheets).

---

## 1. SYSTEM ARCHITECTURE & SYNC MECHANISM

The Web App runs a central synchronization server that manages the master asset catalog, pairs with Android devices, and proxies uploads to Google Drive and Google Sheets:

- **Web App Sync Base URL**: `https://<YOUR_WEB_APP_DOMAIN>/api/sync` (or `http://10.0.2.2:3000/api/sync` for Android Emulator)
- **Bidirectional Reconciliation**:
  1. The Android app stores assets locally in a Room SQLite database (offline-first).
  2. The Android app regularly invokes `POST /api/sync/reconcile` (or runs a periodic `WorkManager` background job).
  3. **App -> Web App -> Google Drive**: When an asset is captured or added on Android, the mobile app sends it to the web app with its metadata and photo (as Base64 or URL). The Web App takes this asset, uploads the high-res file directly into the designated Google Drive folder (`Studio Moodboard Assets`), appends a formatted row into the Master Google Sheet (`Interior Moodboard Asset Catalog`), and updates the asset record with its live Google Drive link (`driveUrl` and `previewUrl`).
  4. **Web App -> Android**: Any assets uploaded or modified on the Web App (or imported from the Master Sheet) are returned in `assetsToDownload` during reconciliation and inserted/updated into the mobile app's local Room database.

---

## 2. API CONTRACT SPECIFICATION

Base URL: `https://<YOUR_WEB_APP_DOMAIN>/api/sync`

### A. Reconcile Endpoint (Two-Way Sync)
- **Method**: `POST /api/sync/reconcile`
- **Headers**:
  - `Content-Type: application/json`
  - `X-Device-Id: <unique_android_device_id>`
  - `X-Device-Name: <device_model_e.g._Pixel_8_Pro>`
- **Request Body**:
  ```json
  {
    "deviceId": "android-pixel8-72b1",
    "deviceName": "Pixel 8 Pro - Studio Field",
    "lastSyncTimestamp": "2026-09-04T12:00:00.000Z",
    "clientAssets": [
      {
        "id": "AST-839201",
        "title": "Roman Travertine Basin Unit",
        "description": "Field capture of custom bathroom vanity with brushed brass trim.",
        "uploadedAt": "2026-09-05T08:30:00.000Z",
        "spaces": ["Bathroom"],
        "styles": ["Warm Modern", "Wabi-Sabi"],
        "materials": ["Travertine Stone", "Brushed Brass"],
        "elements": ["Sanitaryware", "Bespoke Joinery"],
        "customTags": ["#FieldInspection", "#VillaComo"],
        "paletteHex": "#E2D7C3",
        "uploader": "designer@atelier.studio",
        "imageBase64": "data:image/jpeg;base64,...", // Optional base64 encoded photo
        "previewUrl": "" // Empty if newly captured; web app will populate after Drive upload
      }
    ]
  }
  ```
- **Response (200 OK)**:
  ```json
  {
    "success": true,
    "serverTimestamp": "2026-09-05T08:35:12.000Z",
    "assetsToDownload": [
      {
        "id": "AST-902184",
        "title": "Kyoto Minimalist Living Pavilion",
        "description": "Low-slung solid white oak joinery with natural cleft travertine hearth...",
        "driveUrl": "https://drive.google.com/file/d/...",
        "previewUrl": "https://lh3.googleusercontent.com/d/...",
        "spaces": ["Living Room"],
        "styles": ["Japandi", "Minimalist"],
        "materials": ["White Oak Veneer", "Travertine Stone", "Linen"],
        "elements": ["Bespoke Joinery", "Accent Seating"],
        "customTags": ["#Villa-Kyoto"],
        "paletteHex": "#E2D7C3",
        "uploader": "studio@atelier.studio",
        "uploadedAt": "2026-09-04T14:32:00.000Z"
      }
    ],
    "newlyReceivedCount": 1,
    "totalServerAssets": 18,
    "pendingDriveUploads": 1,
    "message": "Reconciliation complete"
  }
  ```

### B. Single Asset Push Endpoint
- **Method**: `POST /api/sync/push`
- **Request Body**: Single asset JSON (same fields as above).

### C. Fetch Full Catalog
- **Method**: `GET /api/sync/assets`
- Optional query: `?since=2026-09-01T00:00:00.000Z`

### D. Sync Hub Status & Heartbeat
- **Method**: `GET /api/sync/info`
- Returns server status, active device list, and count of pending Google Drive uploads.

---

## 3. ANDROID KOTLIN IMPLEMENTATION

### A. Dependencies (`build.gradle.kts`)
```kotlin
dependencies {
    // Room Database
    implementation("androidx.room:room-runtime:2.6.1")
    implementation("androidx.room:room-ktx:2.6.1")
    ksp("androidx.room:room-compiler:2.6.1")

    // Retrofit & OkHttp
    implementation("com.squareup.retrofit2:retrofit:2.11.0")
    implementation("com.squareup.retrofit2:converter-gson:2.11.0")
    implementation("com.squareup.okhttp3:logging-interceptor:4.12.0")

    // WorkManager (Background Sync)
    implementation("androidx.work:work-runtime-ktx:2.9.0")

    // Image Loading (Coil)
    implementation("io.coil-kt:coil-compose:2.6.0")
}
```

### B. Room Entity & Converters
```kotlin
package studio.atelier.moodboard.data.local

import androidx.room.Entity
import androidx.room.PrimaryKey
import androidx.room.TypeConverter
import androidx.room.TypeConverters
import com.google.gson.Gson
import com.google.gson.reflect.TypeToken

@Entity(tableName = "assets")
@TypeConverters(StringListConverter::class)
data class AssetEntity(
    @PrimaryKey val id: String,
    val title: String,
    val description: String,
    val driveUrl: String?,
    val previewUrl: String?,
    val spaces: List<String>,
    val styles: List<String>,
    val materials: List<String>,
    val elements: List<String>,
    val customTags: List<String>,
    val paletteHex: String,
    val uploader: String,
    val uploadedAt: String,
    val localPhotoPath: String? = null,
    val isSyncedWithServer: Boolean = true
)

class StringListConverter {
    private val gson = Gson()

    @TypeConverter
    fun fromStringList(value: List<String>?): String {
        return gson.toJson(value ?: emptyList<String>())
    }

    @TypeConverter
    fun toStringList(value: String?): List<String> {
        if (value.isNullOrEmpty()) return emptyList()
        val type = object : TypeToken<List<String>>() {}.type
        return gson.fromJson(value, type)
    }
}
```

### C. Retrofit API Interface
```kotlin
package studio.atelier.moodboard.data.remote

import retrofit2.Response
import retrofit2.http.*

data class ReconcileRequest(
    val deviceId: String,
    val deviceName: String,
    val lastSyncTimestamp: String?,
    val clientAssets: List<RemoteAsset>
)

data class RemoteAsset(
    val id: String,
    val title: String,
    val description: String,
    val driveUrl: String?,
    val previewUrl: String?,
    val spaces: List<String>,
    val styles: List<String>,
    val materials: List<String>,
    val elements: List<String>,
    val customTags: List<String>,
    val paletteHex: String,
    val uploader: String,
    val uploadedAt: String,
    val imageBase64: String? = null
)

data class ReconcileResponse(
    val success: Boolean,
    val serverTimestamp: String,
    val assetsToDownload: List<RemoteAsset>,
    val newlyReceivedCount: Int,
    val totalServerAssets: Int
)

interface AtelierSyncApi {
    @POST("api/sync/reconcile")
    suspend fun reconcile(
        @Header("X-Device-Id") deviceId: String,
        @Header("X-Device-Name") deviceName: String,
        @Body request: ReconcileRequest
    ): Response<ReconcileResponse>

    @GET("api/sync/assets")
    suspend fun getAssets(
        @Query("since") since: String? = null
    ): Response<Map<String, Any>>
}
```

### D. Sync Repository
```kotlin
package studio.atelier.moodboard.data.repository

import android.content.Context
import android.os.Build
import android.provider.Settings
import studio.atelier.moodboard.data.local.AssetDao
import studio.atelier.moodboard.data.local.AssetEntity
import studio.atelier.moodboard.data.remote.AtelierSyncApi
import studio.atelier.moodboard.data.remote.ReconcileRequest
import studio.atelier.moodboard.data.remote.RemoteAsset
import java.text.SimpleDateFormat
import java.util.*

class AssetSyncRepository(
    private val context: Context,
    private val dao: AssetDao,
    private val api: AtelierSyncApi
) {
    suspend fun performTwoWaySync(): Result<Int> {
        return try {
            val deviceId = Settings.Secure.getString(context.contentResolver, Settings.Secure.ANDROID_ID) ?: "android-device"
            val deviceName = "${Build.MANUFACTURER} ${Build.MODEL}"

            // 1. Gather all locally created or un-synced assets
            val localAssets = dao.getAllAssetsList()
            val unSyncedAssets = localAssets.filter { !it.isSyncedWithServer }

            val clientPayload = unSyncedAssets.map { it.toRemoteAsset(context) }

            // 2. Call Reconcile Endpoint
            val response = api.reconcile(
                deviceId = deviceId,
                deviceName = deviceName,
                request = ReconcileRequest(
                    deviceId = deviceId,
                    deviceName = deviceName,
                    lastSyncTimestamp = getLastSyncTimestamp(),
                    clientAssets = clientPayload
                )
            )

            if (!response.isSuccessful || response.body() == null) {
                return Result.failure(Exception("Sync server error: ${response.code()}"))
            }

            val result = response.body()!!

            // 3. Mark uploaded local assets as synced
            unSyncedAssets.forEach {
                dao.markAssetSynced(it.id)
            }

            // 4. Download and save server-side / Google Drive assets
            val incoming = result.assetsToDownload.map { it.toEntity() }
            if (incoming.isNotEmpty()) {
                dao.insertOrUpdateAssets(incoming)
            }

            // 5. Store new sync timestamp
            saveLastSyncTimestamp(result.serverTimestamp)

            Result.success(incoming.size)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    private fun getLastSyncTimestamp(): String? {
        val prefs = context.getSharedPreferences("atelier_sync", Context.MODE_PRIVATE)
        return prefs.getString("last_sync_timestamp", null)
    }

    private fun saveLastSyncTimestamp(ts: String) {
        val prefs = context.getSharedPreferences("atelier_sync", Context.MODE_PRIVATE)
        prefs.edit().putString("last_sync_timestamp", ts).apply()
    }
}
```

### E. WorkManager Background Worker (`SyncWorker.kt`)
```kotlin
package studio.atelier.moodboard.worker

import android.content.Context
import androidx.work.*
import studio.atelier.moodboard.AtelierApplication
import java.util.concurrent.TimeUnit

class SyncWorker(
    context: Context,
    workerParams: WorkerParameters
) : CoroutineWorker(context, workerParams) {

    override suspend fun doWork(): Result {
        val repository = (applicationContext as AtelierApplication).syncRepository
        val result = repository.performTwoWaySync()
        return if (result.isSuccess) Result.success() else Result.retry()
    }

    companion object {
        fun schedulePeriodicSync(context: Context) {
            val constraints = Constraints.Builder()
                .setRequiredNetworkType(NetworkType.CONNECTED)
                .build()

            val syncRequest = PeriodicWorkRequestBuilder<SyncWorker>(15, TimeUnit.MINUTES)
                .setConstraints(constraints)
                .setBackoffCriteria(BackoffPolicy.EXPONENTIAL, 1, TimeUnit.MINUTES)
                .build()

            WorkManager.getInstance(context).enqueueUniquePeriodicWork(
                "AtelierMoodboardSync",
                ExistingPeriodicWorkPolicy.KEEP,
                syncRequest
            )
        }
    }
}
```

---

## 4. VERIFICATION CHECKLIST

- [ ] Ensure Android `AndroidManifest.xml` includes `<uses-permission android:name="android.permission.INTERNET" />` and `<uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />`.
- [ ] If testing on local development container or localhost, configure `network_security_config.xml` to allow cleartext traffic for local subnets.
- [ ] When an asset is created offline on the phone, observe `SyncWorker` push the asset to the web app.
- [ ] In the web app, check the Google Drive Folder (`Studio Moodboard Assets`) and Google Sheet (`Interior Moodboard Asset Catalog`) to confirm the mobile asset appears with high-resolution image preview and all architectural tags.
- [ ] When a web user uploads an asset from the browser, verify that the Android app downloads it on the next sync interval.
```
