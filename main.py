import joblib
import xgboost
from xgboost import XGBClassifier
from datetime import date, timedelta
import datetime
import openmeteo_requests
import requests_cache
from retry_requests import retry
import pandas as pd
import json
import warnings
from pandas.errors import PerformanceWarning
import requests
import sklearn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

#Set up fastAPI

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"]
)

warnings.filterwarnings('ignore', category=PerformanceWarning) #Disable warning


model = XGBClassifier()

#model.load_model('Extreme Heat.json')

def get_data(lat,long):
  #Get date range
  today_date = date.today()

  # Calculate start and end dates as datetime objects for internal calculations
  start_datetime = pd.to_datetime(today_date - timedelta(days=3))
  end_datetime = pd.to_datetime(today_date - timedelta(days=1))

  # Format dates as strings for the API call
  api_start_date = (today_date - timedelta(days=3)).strftime("%Y-%m-%d")
  api_end_date = (today_date - timedelta(days=1)).strftime("%Y-%m-%d")


  # Setup the Open-Meteo API client with cache and retry on error
  cache_session = requests_cache.CachedSession('.cache', expire_after = 3600)
  retry_session = retry(cache_session, retries = 5, backoff_factor = 0.2)
  openmeteo = openmeteo_requests.Client(session = retry_session)

  # Make sure all required weather variables are listed here
  # The order of variables in hourly or daily is important to assign them correctly below
  url = "https://api.open-meteo.com/v1/forecast"
  params = {
    "latitude": lat,
    "longitude": long,
    "hourly": ["temperature_2m", "relative_humidity_2m", "surface_pressure", "evapotranspiration", "wind_speed_10m", "wind_gusts_10m", "soil_moisture_3_to_9cm", "dew_point_2m", "cape", "uv_index", "lifted_index", "freezing_level_height", "vapour_pressure_deficit", "visibility"],
    "start_date": api_start_date,
    "end_date": api_end_date,
  }
  responses = openmeteo.weather_api(url, params=params)

  # Process first location. Add a for-loop for multiple locations or weather models
  response = responses[0]


  # Process hourly data. The order of variables needs to be the same as requested.
  hourly = response.Hourly()
  hourly_temperature_2m = hourly.Variables(0).ValuesAsNumpy()
  hourly_relative_humidity_2m = hourly.Variables(1).ValuesAsNumpy()
  hourly_surface_pressure = hourly.Variables(2).ValuesAsNumpy()
  hourly_evapotranspiration = hourly.Variables(3).ValuesAsNumpy()
  hourly_wind_speed_10m = hourly.Variables(4).ValuesAsNumpy()
  hourly_wind_gusts_10m = hourly.Variables(5).ValuesAsNumpy()
  hourly_soil_moisture_3_to_9cm = hourly.Variables(6).ValuesAsNumpy()
  hourly_dew_point_2m = hourly.Variables(7).ValuesAsNumpy()
  hourly_cape = hourly.Variables(8).ValuesAsNumpy()
  hourly_uv_index = hourly.Variables(9).ValuesAsNumpy()
  hourly_lifted_index = hourly.Variables(10).ValuesAsNumpy()
  hourly_freezing_level_height = hourly.Variables(11).ValuesAsNumpy()
  hourly_vapour_pressure_deficit = hourly.Variables(12).ValuesAsNumpy()
  hourly_visibility = hourly.Variables(13).ValuesAsNumpy()

  hourly_data = {"date": pd.date_range(
    start = pd.to_datetime(hourly.Time(), unit = "s", utc = True),
    end =  pd.to_datetime(hourly.TimeEnd(), unit = "s", utc = True),
    freq = pd.Timedelta(seconds = hourly.Interval()),
    inclusive = "left"
  )}

  hourly_data["temperature_2m"] = hourly_temperature_2m
  hourly_data["relative_humidity_2m"] = hourly_relative_humidity_2m
  hourly_data["surface_pressure"] = hourly_surface_pressure
  hourly_data["evapotranspiration"] = hourly_evapotranspiration
  hourly_data["wind_speed_10m"] = hourly_wind_speed_10m
  hourly_data["wind_gusts_10m"] = hourly_wind_gusts_10m
  hourly_data["soil_moisture_3_to_9cm"] = hourly_soil_moisture_3_to_9cm
  hourly_data["dew_point_2m"] = hourly_dew_point_2m
  hourly_data["cape"] = hourly_cape
  hourly_data["uv_index"] = hourly_uv_index
  hourly_data["lifted_index"] = hourly_lifted_index
  hourly_data["freezing_level_height"] = hourly_freezing_level_height
  hourly_data["vapour_pressure_deficit"] = hourly_vapour_pressure_deficit
  hourly_data["visibility"] = hourly_visibility

  hourly_dataframe = pd.DataFrame(data = hourly_data)
  #Enter in lat and long data
  hourly_dataframe['longitude'] = long
  hourly_dataframe['latitude'] = lat

  #Get the number of hours since start date
  hourly_dataframe['date'] = hourly_dataframe['date'].dt.tz_convert(None)
  hourly_dataframe['hours_since_start'] = (1+(hourly_dataframe['date'] - start_datetime)/pd.Timedelta(hours = 1))
  return hourly_dataframe

def feature_engineer(weather_data):
  #Create the time_shifted dataframe
  shifted_data = pd.DataFrame({
      'temperature_2m_72_hours_ago' : [],
      'relative_humidity_2m_72_hours_ago' : [],
      'surface_pressure_72_hours_ago' : [],
      'visibility_72_hours_ago' : [],
      'wind_speed_10m_72_hours_ago' : [],
      'wind_gusts_10m_72_hours_ago' : [],
      'soil_moisture_3_to_9cm_72_hours_ago' : [],
      'dew_point_2m_72_hours_ago' : [],
      'uv_index_72_hours_ago' : [],
      'cape_72_hours_ago' : [],
      'lifted_index_72_hours_ago' : [],
      'freezing_level_height_72_hours_ago' : [],
      'evapotranspiration_72_hours_ago' : [],
      'vapour_pressure_deficit_72_hours_ago' : [],

      'temperature_2m_66_hours_ago' : [],
      'relative_humidity_2m_66_hours_ago' : [],
      'surface_pressure_66_hours_ago' : [],
      'visibility_66_hours_ago' : [],
      'wind_speed_10m_66_hours_ago' : [],
      'wind_gusts_10m_66_hours_ago' : [],
      'soil_moisture_3_to_9cm_66_hours_ago' : [],
      'dew_point_2m_66_hours_ago' : [],
      'uv_index_66_hours_ago' : [],
      'cape_66_hours_ago' : [],
      'lifted_index_66_hours_ago' : [],
      'freezing_level_height_66_hours_ago' : [],
      'evapotranspiration_66_hours_ago' : [],
      'vapour_pressure_deficit_66_hours_ago' : [],

      'temperature_2m_60_hours_ago' : [],
      'relative_humidity_2m_60_hours_ago' : [],
      'surface_pressure_60_hours_ago' : [],
      'visibility_60_hours_ago' : [],
      'wind_speed_10m_60_hours_ago' : [],
      'wind_gusts_10m_60_hours_ago' : [],
      'soil_moisture_3_to_9cm_60_hours_ago' : [],
      'dew_point_2m_60_hours_ago' : [],
      'uv_index_60_hours_ago' : [],
      'cape_60_hours_ago' : [],
      'lifted_index_60_hours_ago' : [],
      'freezing_level_height_60_hours_ago' : [],
      'evapotranspiration_60_hours_ago' : [],
      'vapour_pressure_deficit_60_hours_ago' : [],

      'temperature_2m_54_hours_ago' : [],
      'relative_humidity_2m_54_hours_ago' : [],
      'surface_pressure_54_hours_ago' : [],
      'visibility_54_hours_ago' : [],
      'wind_speed_10m_54_hours_ago' : [],
      'wind_gusts_10m_54_hours_ago' : [],
      'soil_moisture_3_to_9cm_54_hours_ago' : [],
      'dew_point_2m_54_hours_ago' : [],
      'uv_index_54_hours_ago' : [],
      'cape_54_hours_ago' : [],
      'lifted_index_54_hours_ago' : [],
      'freezing_level_height_54_hours_ago' : [],
      'evapotranspiration_54_hours_ago' : [],
      'vapour_pressure_deficit_54_hours_ago' : [],

      'temperature_2m_48_hours_ago' : [],
      'relative_humidity_2m_48_hours_ago' : [],
      'surface_pressure_48_hours_ago' : [],
      'visibility_48_hours_ago' : [],
      'wind_speed_10m_48_hours_ago' : [],
      'wind_gusts_10m_48_hours_ago' : [],
      'soil_moisture_3_to_9cm_48_hours_ago' : [],
      'dew_point_2m_48_hours_ago' : [],
      'uv_index_48_hours_ago' : [],
      'cape_48_hours_ago' : [],
      'lifted_index_48_hours_ago' : [],
      'freezing_level_height_48_hours_ago' : [],
      'evapotranspiration_48_hours_ago' : [],
      'vapour_pressure_deficit_48_hours_ago' : [],

      'temperature_2m_42_hours_ago' : [],
      'relative_humidity_2m_42_hours_ago' : [],
      'surface_pressure_42_hours_ago' : [],
      'visibility_42_hours_ago' : [],
      'wind_speed_10m_42_hours_ago' : [],
      'wind_gusts_10m_42_hours_ago' : [],
      'soil_moisture_3_to_9cm_42_hours_ago' : [],
      'dew_point_2m_42_hours_ago' : [],
      'uv_index_42_hours_ago' : [],
      'cape_42_hours_ago' : [],
      'lifted_index_42_hours_ago' : [],
      'freezing_level_height_42_hours_ago' : [],
      'evapotranspiration_42_hours_ago' : [],
      'vapour_pressure_deficit_42_hours_ago' : [],

      'temperature_2m_36_hours_ago' : [],
      'relative_humidity_2m_36_hours_ago' : [],
      'surface_pressure_36_hours_ago' : [],
      'visibility_36_hours_ago' : [],
      'wind_speed_10m_36_hours_ago' : [],
      'wind_gusts_10m_36_hours_ago' : [],
      'soil_moisture_3_to_9cm_36_hours_ago' : [],
      'dew_point_2m_36_hours_ago' : [],
      'uv_index_36_hours_ago' : [],
      'cape_36_hours_ago' : [],
      'lifted_index_36_hours_ago' : [],
      'freezing_level_height_36_hours_ago' : [],
      'evapotranspiration_36_hours_ago' : [],
      'vapour_pressure_deficit_36_hours_ago' : [],

      'temperature_2m_30_hours_ago' : [],
      'relative_humidity_2m_30_hours_ago' : [],
      'surface_pressure_30_hours_ago' : [],
      'visibility_30_hours_ago' : [],
      'wind_speed_10m_30_hours_ago' : [],
      'wind_gusts_10m_30_hours_ago' : [],
      'soil_moisture_3_to_9cm_30_hours_ago' : [],
      'dew_point_2m_30_hours_ago' : [],
      'uv_index_30_hours_ago' : [],
      'cape_30_hours_ago' : [],
      'lifted_index_30_hours_ago' : [],
      'freezing_level_height_30_hours_ago' : [],
      'evapotranspiration_30_hours_ago' : [],
      'vapour_pressure_deficit_30_hours_ago' : [],

      'temperature_2m_24_hours_ago' : [],
      'relative_humidity_2m_24_hours_ago' : [],
      'surface_pressure_24_hours_ago' : [],
      'visibility_24_hours_ago' : [],
      'wind_speed_10m_24_hours_ago' : [],
      'wind_gusts_10m_24_hours_ago' : [],
      'soil_moisture_3_to_9cm_24_hours_ago' : [],
      'dew_point_2m_24_hours_ago' : [],
      'uv_index_24_hours_ago' : [],
      'cape_24_hours_ago' : [],
      'lifted_index_24_hours_ago' : [],
      'freezing_level_height_24_hours_ago' : [],
      'evapotranspiration_24_hours_ago' : [],
      'vapour_pressure_deficit_24_hours_ago' : [],
      })
  shifted_data = pd.DataFrame({})
  #Add in the time shifted data
  for i in range(18, 78, 6):
    temp_df = pd.DataFrame({})
    temp_row = weather_data[weather_data['hours_since_start']==i]
    temp_df[f'temperature_2m_{i}_hours_ago'] = temp_row.loc[:,'temperature_2m']
    temp_df[f'relative_humidity_2m_{i}_hours_ago'] = temp_row.loc[:,'relative_humidity_2m']
    temp_df[f'surface_pressure_{i}_hours_ago'] = temp_row.loc[:,'surface_pressure']
    temp_df[f'visibility_{i}_hours_ago'] = temp_row.loc[:,'visibility']
    temp_df[f'wind_speed_10m_{i}_hours_ago'] = temp_row.loc[:,'wind_speed_10m']
    temp_df[f'wind_gusts_10m_{i}_hours_ago'] = temp_row.loc[:,'wind_gusts_10m']
    temp_df[f'soil_moisture_3_to_9cm_{i}_hours_ago'] = temp_row.loc[:,'soil_moisture_3_to_9cm']
    temp_df[f'dew_point_2m_{i}_hours_ago'] = temp_row.loc[:,'dew_point_2m']
    temp_df[f'uv_index_{i}_hours_ago'] = temp_row.loc[:,'uv_index']
    temp_df[f'cape_{i}_hours_ago'] = temp_row.loc[:,'cape']
    temp_df[f'lifted_index_{i}_hours_ago'] = temp_row.loc[:,'lifted_index']
    temp_df[f'freezing_level_height_{i}_hours_ago'] = temp_row.loc[:,'freezing_level_height']
    temp_df[f'evapotranspiration_{i}_hours_ago'] = temp_row.loc[:,'evapotranspiration']
    temp_df[f'vapour_pressure_deficit_{i}_hours_ago'] = temp_row.loc[:,'vapour_pressure_deficit']
    lst = [0]
    temp_df.index = lst
    shifted_data = pd.concat([shifted_data, temp_df], axis = 1)




  #Change all values to delta(change over time) instead of values at that moment
  for i in range(24, 78, 6):
    shifted_data[f'delta_temperature_2m_{i}_hours_ago'] = shifted_data[f'temperature_2m_{i}_hours_ago'] - shifted_data[f'temperature_2m_{i-6}_hours_ago']
    shifted_data[f'delta_relative_humidity_2m_{i}_hours_ago'] = shifted_data[f'relative_humidity_2m_{i}_hours_ago'] - shifted_data[f'relative_humidity_2m_{i-6}_hours_ago']
    shifted_data[f'delta_surface_pressure_{i}_hours_ago'] = shifted_data[f'surface_pressure_{i}_hours_ago'] - shifted_data[f'surface_pressure_{i-6}_hours_ago']
    shifted_data[f'delta_visibility_{i}_hours_ago'] = shifted_data[f'visibility_{i}_hours_ago'] - shifted_data[f'visibility_{i-6}_hours_ago']
    shifted_data[f'delta_wind_speed_10m_{i}_hours_ago'] = shifted_data[f'wind_speed_10m_{i}_hours_ago'] - shifted_data[f'wind_speed_10m_{i-6}_hours_ago']
    shifted_data[f'delta_wind_gusts_10m_{i}_hours_ago'] = shifted_data[f'wind_gusts_10m_{i}_hours_ago'] - shifted_data[f'wind_gusts_10m_{i-6}_hours_ago']
    shifted_data[f'delta_soil_moisture_3_to_9cm_{i}_hours_ago'] = shifted_data[f'soil_moisture_3_to_9cm_{i}_hours_ago'] - shifted_data[f'soil_moisture_3_to_9cm_{i-6}_hours_ago']
    shifted_data[f'delta_dew_point_2m_{i}_hours_ago'] = shifted_data[f'dew_point_2m_{i}_hours_ago'] - shifted_data[f'dew_point_2m_{i-6}_hours_ago']
    shifted_data[f'delta_uv_index_{i}_hours_ago'] = shifted_data[f'uv_index_{i}_hours_ago'] - shifted_data[f'uv_index_{i-6}_hours_ago']
    shifted_data[f'delta_cape_{i}_hours_ago'] = shifted_data[f'cape_{i}_hours_ago'] - shifted_data[f'cape_{i-6}_hours_ago']
    shifted_data[f'delta_lifted_index_{i}_hours_ago'] = shifted_data[f'lifted_index_{i}_hours_ago'] - shifted_data[f'lifted_index_{i-6}_hours_ago']
    shifted_data[f'delta_freezing_level_height_{i}_hours_ago'] = shifted_data[f'freezing_level_height_{i}_hours_ago'] - shifted_data[f'freezing_level_height_{i-6}_hours_ago']
    shifted_data[f'delta_evapotranspiration_{i}_hours_ago'] = shifted_data[f'evapotranspiration_{i}_hours_ago'] - shifted_data[f'evapotranspiration_{i-6}_hours_ago']
    shifted_data[f'delta_vapour_pressure_deficit_{i}_hours_ago'] = shifted_data[f'vapour_pressure_deficit_{i}_hours_ago'] - shifted_data[f'vapour_pressure_deficit_{i-6}_hours_ago']

  shifted_data['date'] = weather_data['date']
  shifted_data['latitude'] = weather_data['latitude']
  shifted_data['longitude'] = weather_data['longitude']
  cols = pd.Series(shifted_data.columns.to_list())
  mask = cols.str.contains('18')
  shifted_data.drop(columns = cols[mask], inplace = True)
  return shifted_data


def format_time(df):  #Get a separate column for days and months
  # Disable warnings
  pd.options.mode.chained_assignment = None
  #Only include the year, month, day, hour, mintue and seconds, not time zone shift
  df['date'] = pd.to_datetime(df['date'])
  df['date'] = df['date'].dt.tz_localize(None)
  df['date'] = pd.to_datetime(df['date'])
  df['month'] = df['date'].dt.month
  df['day'] = df['date'].dt.day
  return df

def predict(df):
  #Get the data formatted for the model to process
  cols = pd.Series(df.columns.to_list())
  heavy_rain = ['temperature_2m', 'relative_humidity_2m', 'surface_pressure', 'wind_gusts_10m', 'dew_point_2m', 'cape', 'lifted_index', 'latitude', 'longitude', 'month', 'day']
  snowstorms = ['temperature_2m', 'surface_pressure', 'relative_humidity_2m', 'latitude', 'longitude', 'month', 'day']
  extreme_heat = ['temperature_2m', 'soil_moisture_3_to_9cm', 'relative_humidity_2m', 'visibility', 'evapotranspiration', 'vapour_pressure_deficit', 'latitude', 'longitude', 'month', 'day']
  extreme_cold = ['temperature_2m', 'surface_pressure', 'wind_speed_10m', 'dew_point_2m', 'latitude', 'longitude', 'month', 'day']
  high_speed_wind = ['temperature_2m', 'visibility', 'surface_pressure', 'latitude', 'longitude', 'month', 'day']
  hail = ['wind_gusts_10m', 'surface_pressure', 'temperature_2m', 'dew_point_2m', 'visibility', 'cape', 'latitude', 'longitude', 'month', 'day']

  df_heavy_rain = df[cols[cols.str.contains('|'.join(heavy_rain))]]
  df_snowstorms = df[cols[cols.str.contains('|'.join(snowstorms))]]
  df_extreme_heat = df[cols[cols.str.contains('|'.join(extreme_heat))]]
  df_extreme_cold = df[cols[cols.str.contains('|'.join(extreme_cold))]]
  df_high_speed_wind = df[cols[cols.str.contains('|'.join(high_speed_wind))]]
  df_hail = df[cols[cols.str.contains('|'.join(hail))]]

  #load in the models
  heavy_rain_model = joblib.load('AI Models/Heavy Rain.joblib')
  snowstorms_model = joblib.load('AI Models/Snowstorms.joblib')
  extreme_heat_model = joblib.load('AI Models/Extreme Heat.joblib')
  extreme_cold_model = joblib.load('AI Models/Extreme Cold.joblib')
  high_speed_wind_model = joblib.load('AI Models/Extreme Winds.joblib')
  hail_model = joblib.load('AI Models/Hail.joblib')

  #predict
  heavy_rain_chance = heavy_rain_model.predict_proba(df_heavy_rain)[0]
  snowstorm_chance = snowstorms_model.predict_proba(df_snowstorms)[0]
  extreme_heat_chance = extreme_heat_model.predict_proba(df_extreme_heat)[0]
  extreme_cold_chance = extreme_cold_model.predict_proba(df_extreme_cold)[0]
  high_speed_wind_chance = high_speed_wind_model.predict_proba(df_high_speed_wind)[0]
  hail_chance = hail_model.predict_proba(df_hail)[0]

  heavy_rain_chance = round(heavy_rain_chance[0].astype(float) * heavy_rain_chance[1].astype(float), 4)
  snowstorm_chance = round(snowstorm_chance[0].astype(float) * snowstorm_chance[1].astype(float), 4)
  extreme_heat_chance = round(extreme_heat_chance[0].astype(float) * extreme_heat_chance[1].astype(float), 4)
  extreme_cold_chance = round(extreme_cold_chance[0].astype(float) * extreme_cold_chance[1].astype(float), 4)
  high_speed_wind_chance = round(high_speed_wind_chance[0].astype(float) * high_speed_wind_chance[1].astype(float), 4)
  hail_chance = round(hail_chance[0].astype(float) * hail_chance[1].astype(float), 4)
  dct = {'Heavy Rain Chance' : heavy_rain_chance,
         'Snowstorm Chance' : snowstorm_chance,
         'Extreme Heat Chance' : extreme_heat_chance,
         'Extreme Cold Chance' : extreme_cold_chance,
         'High Speed Wind Chance' : high_speed_wind_chance,
         'Hail Chance' : hail_chance
         }
  return dct
import requests

#Convert lat and long into fips
def get_fips_from_fcc(lat, lon):
    #Use FCC Area API to convert lat+long into fips
    # FCC Area API endpoint
    url = "https://geo.fcc.gov/api/census/area"

    # Parameters for the API call
    params = {
        'lat': lat,
        'lon': lon,
        'format': 'json'
    }

    try:
        response = requests.get(url, params=params)
        response.raise_for_status()  # Raise error for bad status codes
        data = response.json()

        if data.get('results'):
            result = data['results'][0]
            return {
                "block_fips": result.get("block_fips"),
                "county_fips": result.get("county_fips"),
                "county_name": result.get("county_name"),
                "state_fips": result.get("state_fips"),
                "state_code": result.get("state_code")
            }
        else:
            return "No results found for these coordinates."

    except requests.exceptions.RequestException as e:
        return f"API Request failed: {e}"


#Fast API connection to frontend
@app.get("/")
def home():
    return {"message": "Welcome to the Weather Prediction API! Use the /predict endpoint with latitude and longitude parameters to get predictions."}
#Done, works properly
@app.get("/predict")
def predict_weather(lat,lon):
  try:
    df = get_data(float(lat),float(lon))
    df = feature_engineer(df)
    df = format_time(df)
    chances = predict(df)
    return chances
  except Exception as e:
    print(str(e))
    return {"error": str(e)}

#TODO
#Somehow find a way to store and convert every FIPS into lat and long,
#then run it through open-meteo while not getting rate limited.
@app.get("/all_locations")
def get_all_locations():
  pass

from fastapi import FastAPI
import joblib
# ... other imports

app = FastAPI()

if __name__ == "__main__":
    import uvicorn
    import os
    # This line is critical for the cloud: 
    # It looks for a port assigned by Render/Railway, or defaults to 8000
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port)


#Testing 
"""lat = 21
lon = 21
df = get_data(float(lat),float(lon))
#Gets data ready to be inputted into AI model

df = feature_engineer(df)
df = format_time(df)
cols = df.columns.to_list()
chances = predict(df)
for name in chances:
  print(name,': ', chances[name])"""
