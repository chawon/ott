"""Run the real worker/scheduler against in-memory Android API test doubles.

Requires Python 3 and JDK 17+, without an Android SDK. This checks scan decisions,
not Android's background execution or the actual notification UI.
"""

from pathlib import Path
import subprocess
import sys
import tempfile

root = Path(__file__).resolve().parents[3]
sources = {
    'android/content/SharedPreferences.java': '''package android.content;
import java.util.*;
public class SharedPreferences {
  private final Map<String,Object> values = new HashMap<>();
  public boolean contains(String k) { return values.containsKey(k); }
  public long getLong(String k,long d) { return ((Number)values.getOrDefault(k,d)).longValue(); }
  public int getInt(String k,int d) { return ((Number)values.getOrDefault(k,d)).intValue(); }
  public String getString(String k,String d) { return (String)values.getOrDefault(k,d); }
  public boolean getBoolean(String k,boolean d) { return (Boolean)values.getOrDefault(k,d); }
  public Editor edit() { return new Editor(); }
  public class Editor {
    private final Map<String,Object> changes = new HashMap<>();
    private final Set<String> removals = new HashSet<>();
    public Editor putLong(String k,long v) { changes.put(k,v); return this; }
    public Editor putInt(String k,int v) { changes.put(k,v); return this; }
    public Editor putString(String k,String v) { changes.put(k,v); return this; }
    public Editor putBoolean(String k,boolean v) { changes.put(k,v); return this; }
    public Editor remove(String k) { removals.add(k); return this; }
    public void apply() { for(String k:removals)values.remove(k); values.putAll(changes); }
  }
}''',
    'android/content/Context.java': '''package android.content;
import android.app.usage.UsageStatsManager;
public class Context {
  public static final int MODE_PRIVATE=0;
  public static final String USAGE_STATS_SERVICE="usage";
  public final SharedPreferences prefs = new SharedPreferences();
  public final UsageStatsManager usage = new UsageStatsManager();
  public Context getApplicationContext() { return this; }
  public SharedPreferences getSharedPreferences(String name,int mode) { return prefs; }
  public Object getSystemService(String name) { return usage; }
}''',
    'android/app/usage/UsageStats.java': '''package android.app.usage;
public class UsageStats {
  private final String name; private final long total,last,start;
  public UsageStats(String name,long total,long last,long start) {
    this.name=name; this.total=total; this.last=last; this.start=start;
  }
  public String getPackageName() { return name; }
  public long getTotalTimeInForeground() { return total; }
  public long getLastTimeUsed() { return last; }
  public long getFirstTimeStamp() { return start; }
  public long getLastTimeStamp() { return start+86400000L; }
}''',
    'android/app/usage/UsageStatsManager.java': '''package android.app.usage;
import java.util.*;
public class UsageStatsManager {
  public static final int INTERVAL_DAILY=0;
  public List<UsageStats> stats = new ArrayList<>();
  public List<UsageStats> queryUsageStats(int interval,long start,long end) { return stats; }
}''',
    'androidx/annotation/NonNull.java': 'package androidx.annotation; public @interface NonNull {}',
    'androidx/work/WorkerParameters.java': 'package androidx.work; public class WorkerParameters {}',
    'androidx/work/Worker.java': '''package androidx.work;
import android.content.Context;
public abstract class Worker {
  private final Context context;
  public Worker(Context c,WorkerParameters p) {context=c;}
  public Context getApplicationContext() {return context;}
  public abstract Result doWork();
  public static class Result { public static Result success() {return new Result();} }
}''',
    'androidx/work/ExistingPeriodicWorkPolicy.java': 'package androidx.work; public enum ExistingPeriodicWorkPolicy {UPDATE,KEEP}',
    'androidx/work/PeriodicWorkRequest.java': '''package androidx.work;
import java.util.concurrent.TimeUnit;
public class PeriodicWorkRequest {
  public static final long MIN_PERIODIC_INTERVAL_MILLIS=900000;
  public static class Builder {
    public Builder(Class<?> c,long n,TimeUnit unit) {}
    public PeriodicWorkRequest build() {return new PeriodicWorkRequest();}
  }
}''',
    'androidx/work/OneTimeWorkRequest.java': '''package androidx.work;
import java.util.concurrent.TimeUnit;
public class OneTimeWorkRequest {
  public static class Builder {
    public Builder(Class<?> c) {}
    public Builder setInitialDelay(long n,TimeUnit unit) {return this;}
    public Builder addTag(String s) {return this;}
    public OneTimeWorkRequest build() {return new OneTimeWorkRequest();}
  }
}''',
    'androidx/work/WorkManager.java': '''package androidx.work;
import android.content.Context;
public class WorkManager {
  public static WorkManager getInstance(Context c) {return new WorkManager();}
  public void cancelAllWorkByTag(String s) {}
  public void cancelUniqueWork(String s) {}
  public void enqueueUniquePeriodicWork(String n,ExistingPeriodicWorkPolicy p,PeriodicWorkRequest r) {}
  public void enqueue(OneTimeWorkRequest r) {}
}''',
    'app/ottline/WatchReminderAccess.java': '''package app.ottline;
import android.content.Context;
final class WatchReminderAccess {
  static boolean usage=true,notifications=true;
  static boolean hasUsageAccess(Context c) {return usage;}
  static boolean canPostNotifications(Context c) {return notifications;}
}''',
    'app/ottline/WatchReminderNotifier.java': '''package app.ottline;
import android.content.Context;
final class WatchReminderNotifier {
  static int count;
  static boolean fail;
  static boolean show(Context c,WatchReminderTargets.Target t) {
    if(fail)throw new IllegalStateException("notification service unavailable");
    count++;return true;
  }
}''',
    'app/ottline/WatchReminderRepro.java': '''package app.ottline;
import android.content.*;
import android.app.usage.*;
import java.util.*;

public class WatchReminderRepro {
  static final long MIN=60000L,DAY=86400000L;
  static final long INTERVAL=(System.currentTimeMillis()/DAY)*DAY;
  static final String APP="com.netflix.mediaclient";
  static int failures,scenarios;
  static Context setup(long baseline) {
    Context c=new Context();
    WatchReminderNotifier.count=0;
    WatchReminderNotifier.fail=false;
    WatchReminderAccess.usage=true; WatchReminderAccess.notifications=true;
    c.prefs.edit().putInt(WatchReminderScheduler.KEY_STATE_VERSION,Integer.MAX_VALUE)
      .putBoolean(WatchReminderScheduler.KEY_ENABLED,true)
      .putLong(WatchReminderScheduler.KEY_LAST_QUERY_AT,System.currentTimeMillis()-20*MIN)
      .putLong(WatchReminderScheduler.foregroundTotalKey(APP),baseline)
      .putLong(WatchReminderScheduler.foregroundIntervalKey(APP),INTERVAL)
      .putLong(WatchReminderScheduler.lastUsageKey(APP),System.currentTimeMillis()-MIN).apply();
    return c;
  }
  static void scan(Context c,long total) {
    long now=System.currentTimeMillis();
    c.usage.stats=Arrays.asList(new UsageStats(APP,total,now-MIN,INTERVAL));
    System.out.println("  "+WatchReminderWorker.scanNow(c,false));
  }
  static void check(String name,int want) {
    scenarios++;
    int got=WatchReminderNotifier.count;
    if(got!=want) {failures++;System.out.println("FAIL "+name+": expected "+want+" notification(s), got "+got);}
    else System.out.println("PASS "+name);
  }
  public static void main(String[] args) {
    Context c=setup(0); scan(c,6*MIN); check("single six-minute viewing",1);
    c=setup(0); scan(c,2*MIN); scan(c,4*MIN); scan(c,6*MIN);
    check("six-minute viewing spanning multiple scans",1);
    c=setup(120*MIN);
    long now=System.currentTimeMillis();
    c.prefs.edit().putLong(WatchReminderScheduler.foregroundIntervalKey(APP),INTERVAL-DAY).apply();
    c.usage.stats=Arrays.asList(new UsageStats(APP,10*MIN,now-MIN,INTERVAL));
    System.out.println("  "+WatchReminderWorker.scanNow(c,false));
    check("ten-minute viewing after daily stats rollover",1);
    c=setup(0); scan(c,2*MIN); scan(c,2*MIN); check("short visit stays silent",0);
    c=setup(0); WatchReminderAccess.notifications=false; scan(c,6*MIN);
    check("permission denied stays silent",0);
    WatchReminderAccess.notifications=true; scan(c,6*MIN); check("pending candidate survives permission restoration",1);
    c=setup(0); c.prefs.edit().putLong(WatchReminderScheduler.KEY_LAST_NOTIFICATION_AT,now-MIN).apply();
    scan(c,6*MIN); check("global cooldown stays silent",0);
    c=setup(0); c.prefs.edit().putLong(WatchReminderScheduler.lastNotificationKey(APP),now-60*MIN).apply();
    scan(c,6*MIN); check("per-app cooldown stays silent",0);
    c=setup(0); scan(c,6*MIN);
    c.prefs.edit().remove(WatchReminderScheduler.KEY_LAST_NOTIFICATION_AT)
      .remove(WatchReminderScheduler.lastNotificationKey(APP)).apply();
    scan(c,6*MIN); check("same viewing is not notified twice",1);
    c=setup(0); scan(c,2*MIN); c.usage.stats=Collections.emptyList();
    WatchReminderWorker.scanNow(c,false); scan(c,4*MIN);
    check("empty stats response cannot inflate a short visit",0);
    scan(c,6*MIN); check("empty stats response cannot erase accumulated viewing",1);
    c=setup(0); scan(c,2*MIN); c.usage.stats=null;
    WatchReminderWorker.scanNow(c,false); scan(c,4*MIN);
    check("null stats response cannot inflate a short visit",0);
    scan(c,6*MIN); check("null stats response cannot erase accumulated viewing",1);
    c=setup(0); c.usage.stats=Arrays.asList(
      new UsageStats(APP,60*MIN,now-30_000L,INTERVAL-DAY),
      new UsageStats(APP,2*MIN,now-MIN,INTERVAL));
    WatchReminderWorker.scanNow(c,false);
    check("current interval is selected by interval start",0);
    c=setup(0); c.prefs.edit().remove(WatchReminderScheduler.foregroundIntervalKey(APP)).apply();
    scan(c,60*MIN); check("upgrade baselines existing viewing",0);
    scan(c,66*MIN); check("upgrade resumes new viewing detection",1);
    c=setup(0); c.prefs.edit().putBoolean(WatchReminderScheduler.KEY_ENABLED,false).apply();
    scan(c,6*MIN); check("disabled reminder stays silent",0);
    c=setup(0); WatchReminderAccess.usage=false;
    scan(c,6*MIN); check("missing usage access stays silent",0);
    c=setup(0); WatchReminderNotifier.fail=true;
    scan(c,6*MIN); check("notification service failure stays silent",0);
    WatchReminderNotifier.fail=false;
    scan(c,6*MIN); check("failed notification can retry without new viewing",1);
    c=setup(0); c.usage.stats=Arrays.asList(new UsageStats(APP,60*MIN,now-MIN,INTERVAL));
    WatchReminderScheduler.setEnabled(c,true);
    scan(c,60*MIN); check("enable baselines existing usage",0);
    scan(c,66*MIN); check("new usage after enable notifies",1);
    if(failures>0)throw new AssertionError(failures+" regression scenario(s) failed");
    System.out.println("PASS all "+scenarios+" worker regression scenarios");
  }
}''',
}
with tempfile.TemporaryDirectory(prefix='watch-reminder-repro-') as tmp:
    work = Path(tmp)
    files = []
    for name, content in sources.items():
        target = work / name
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(content)
        files.append(str(target))
    for name in ['WatchReminderWorker.java', 'WatchReminderScheduler.java', 'WatchReminderTargets.java']:
        files.append(str(root / 'apps/twa/app/src/main/java/app/ottline' / name))
    tracker = root / 'apps/twa/app/src/main/java/app/ottline/WatchReminderUsageTracker.java'
    if tracker.exists():
        files.append(str(tracker))
    subprocess.run(['javac', '--release', '17', '-d', str(work / 'classes'), *files], check=True)
    result = subprocess.run(['java', '-cp', str(work / 'classes'), 'app.ottline.WatchReminderRepro'])
    sys.exit(result.returncode)
